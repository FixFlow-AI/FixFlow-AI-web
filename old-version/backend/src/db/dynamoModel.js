const crypto = require('crypto');
const {
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { env } = require('../config/env');
const { getDocClient } = require('./dynamodb');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  }
  if (isPlainObject(value)) {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = deepClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function deepMerge(target, source) {
  const result = deepClone(target || {});
  if (!isPlainObject(source)) {
    return result;
  }

  Object.keys(source).forEach((key) => {
    const incoming = source[key];
    if (incoming === undefined) {
      return;
    }
    if (isPlainObject(incoming) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], incoming);
      return;
    }
    result[key] = deepClone(incoming);
  });

  return result;
}

function normalizeId(value) {
  if (value === undefined || value === null) return value;
  return String(value);
}

function serializeDates(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeDates(item));
  }
  if (isPlainObject(value)) {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = serializeDates(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stripFunctions(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripFunctions(item));
  }
  if (isPlainObject(value)) {
    return Object.keys(value).reduce((acc, key) => {
      const field = value[key];
      if (typeof field === 'function') {
        return acc;
      }
      acc[key] = stripFunctions(field);
      return acc;
    }, {});
  }
  return value;
}

function resolveTableName(modelName) {
  if (env.DYNAMODB_TABLE_PREFIX) {
    return `${env.DYNAMODB_TABLE_PREFIX}_${modelName}`;
  }
  return modelName;
}

function generateId() {
  return crypto.randomUUID();
}

function parseSelect(select) {
  if (!select) return null;
  if (Array.isArray(select)) {
    return { include: select.filter(Boolean), exclude: [] };
  }

  if (typeof select === 'string') {
    const tokens = select
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean);
    const include = tokens.filter((token) => !token.startsWith('-'));
    const exclude = tokens.filter((token) => token.startsWith('-')).map((token) => token.slice(1));
    return { include, exclude };
  }

  return null;
}

function applySelect(item, select) {
  if (!item || !select) return item;
  const { include, exclude } = select;
  const output = {};

  if (include && include.length) {
    include.forEach((field) => {
      if (field in item) {
        output[field] = item[field];
      }
    });
    if ('_id' in item && !('_id' in output)) {
      output._id = item._id;
    }
    if ('id' in item && !('id' in output)) {
      output.id = item.id;
    }
    return output;
  }

  const clone = { ...item };
  exclude.forEach((field) => {
    delete clone[field];
  });

  return clone;
}

function getPathValues(value, pathParts) {
  if (value === undefined || value === null) return [];
  if (!pathParts.length) return [value];

  const [head, ...rest] = pathParts;
  const next = value?.[head];

  if (Array.isArray(next)) {
    return next.flatMap((item) => getPathValues(item, rest));
  }

  return getPathValues(next, rest);
}

function matchesOperator(value, operator, expected) {
  if (operator === '$in') {
    const list = Array.isArray(expected) ? expected : [expected];
    if (Array.isArray(value)) {
      return value.some((item) => list.includes(item));
    }
    return list.includes(value);
  }

  if (operator === '$ne') {
    return value !== expected;
  }

  if (operator === '$gte') {
    return value >= expected;
  }

  if (operator === '$gt') {
    return value > expected;
  }

  if (operator === '$lte') {
    return value <= expected;
  }

  if (operator === '$lt') {
    return value < expected;
  }

  return false;
}

function matchesCondition(value, condition) {
  if (isPlainObject(condition)) {
    const operators = Object.keys(condition).filter((key) => key.startsWith('$'));
    if (operators.length) {
      return operators.every((operator) => matchesOperator(value, operator, condition[operator]));
    }
  }

  if (Array.isArray(value)) {
    return value.some((item) => item === condition);
  }

  return value === condition;
}

function matchesFilter(item, filter) {
  if (!filter || !Object.keys(filter).length) return true;

  const { $or, $and, ...rest } = filter;

  const baseMatch = Object.entries(rest).every(([path, condition]) => {
    const values = getPathValues(item, path.split('.'));
    if (!values.length) {
      return matchesCondition(undefined, condition);
    }
    return values.some((value) => matchesCondition(value, condition));
  });

  const orMatch = Array.isArray($or) ? $or.some((entry) => matchesFilter(item, entry)) : true;
  const andMatch = Array.isArray($and) ? $and.every((entry) => matchesFilter(item, entry)) : true;

  return baseMatch && orMatch && andMatch;
}

function applyUpdate(doc, update) {
  if (!isPlainObject(update)) {
    return doc;
  }

  const operators = Object.keys(update).filter((key) => key.startsWith('$'));

  if (!operators.length) {
    return { ...doc, ...deepClone(update) };
  }

  let result = { ...doc };

  if (update.$set) {
    result = { ...result, ...deepClone(update.$set) };
  }

  if (update.$unset) {
    Object.keys(update.$unset).forEach((key) => {
      delete result[key];
    });
  }

  if (update.$inc) {
    Object.keys(update.$inc).forEach((key) => {
      const base = Number(result[key] || 0);
      result[key] = base + Number(update.$inc[key] || 0);
    });
  }

  if (update.$push) {
    Object.keys(update.$push).forEach((key) => {
      const base = Array.isArray(result[key]) ? [...result[key]] : [];
      const value = update.$push[key];
      if (Array.isArray(value)) {
        result[key] = [...base, ...value];
      } else {
        result[key] = [...base, value];
      }
    });
  }

  if (update.$pull) {
    Object.keys(update.$pull).forEach((key) => {
      const base = Array.isArray(result[key]) ? [...result[key]] : [];
      result[key] = base.filter((entry) => entry !== update.$pull[key]);
    });
  }

  if (update.$addToSet) {
    Object.keys(update.$addToSet).forEach((key) => {
      const base = Array.isArray(result[key]) ? [...result[key]] : [];
      const value = update.$addToSet[key];
      const values = Array.isArray(value) ? value : [value];
      values.forEach((entry) => {
        if (!base.includes(entry)) {
          base.push(entry);
        }
      });
      result[key] = base;
    });
  }

  return result;
}

function buildSortComparator(sort) {
  if (!sort || typeof sort !== 'object') {
    return null;
  }
  const keys = Object.keys(sort);
  if (!keys.length) {
    return null;
  }

  return (left, right) => {
    for (const key of keys) {
      const direction = sort[key] === -1 ? -1 : 1;
      const leftValue = getPathValues(left, key.split('.'))[0];
      const rightValue = getPathValues(right, key.split('.'))[0];
      if (leftValue === rightValue) {
        continue;
      }
      if (leftValue === undefined || leftValue === null) return 1 * direction;
      if (rightValue === undefined || rightValue === null) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      if (leftValue < rightValue) return -1 * direction;
    }
    return 0;
  };
}

async function scanItems(Model, filter) {
  const client = getDocClient();
  const items = [];
  let lastKey;

  do {
    const response = await client.send(
      new ScanCommand({
        TableName: Model.tableName,
        ExclusiveStartKey: lastKey,
      })
    );

    const batch = Array.isArray(response.Items) ? response.Items : [];
    const filtered = filter ? batch.filter((item) => matchesFilter(item, filter)) : batch;
    items.push(...filtered);
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

function attachInstanceMethods(Model, config, item) {
  if (!item) return null;
  const doc = new Model(item);
  if (config.methods) {
    Object.entries(config.methods).forEach(([name, method]) => {
      doc[name] = method.bind(doc);
    });
  }
  return doc;
}

function normalizeOutput(item, idField) {
  if (!item) return null;
  if (!item[idField] && item._id) {
    item[idField] = item._id;
  }
  if (!item._id && item[idField]) {
    item._id = item[idField];
  }
  if (!item.id && item._id) {
    item.id = item._id;
  }
  return item;
}

function toPlainItem(doc) {
  const raw = stripFunctions(doc);
  return serializeDates(raw);
}

function createQuery(Model, config, action, criteria) {
  const state = {
    sort: null,
    skip: 0,
    limit: null,
    lean: false,
    select: null,
  };

  const query = {
    sort(value) {
      state.sort = value;
      return query;
    },
    skip(value) {
      state.skip = Number(value || 0);
      return query;
    },
    limit(value) {
      state.limit = value === null || value === undefined ? null : Number(value);
      return query;
    },
    lean() {
      state.lean = true;
      return query;
    },
    select(value) {
      state.select = parseSelect(value);
      return query;
    },
    async exec() {
      return executeQuery(Model, config, action, criteria, state);
    },
    then(resolve, reject) {
      return query.exec().then(resolve, reject);
    },
    catch(reject) {
      return query.exec().catch(reject);
    },
    finally(handler) {
      return query.exec().finally(handler);
    },
  };

  return query;
}

async function executeQuery(Model, config, action, criteria, state) {
  const client = getDocClient();
  const idField = config.idField;

  if (action === 'findById') {
    const id = normalizeId(criteria);
    if (!id) return null;
    const response = await client.send(
      new GetCommand({
        TableName: Model.tableName,
        Key: { [idField]: id },
      })
    );
    const item = normalizeOutput(response.Item ? { ...response.Item } : null, idField);
    if (!item) return null;
    const selected = applySelect(item, state.select);
    if (state.lean) return selected;
    return attachInstanceMethods(Model, config, selected);
  }

  if (action === 'findOne' && isPlainObject(criteria) && Object.keys(criteria).length === 1 && criteria[idField]) {
    return executeQuery(Model, config, 'findById', criteria[idField], state);
  }

  const items = await scanItems(Model, action === 'findById' ? { [idField]: criteria } : criteria);
  let results = items.map((item) => normalizeOutput({ ...item }, idField));

  const sorter = buildSortComparator(state.sort);
  if (sorter) {
    results.sort(sorter);
  }

  if (state.skip) {
    results = results.slice(state.skip);
  }

  if (state.limit !== null && !Number.isNaN(state.limit)) {
    results = results.slice(0, state.limit);
  }

  if (action === 'findOne') {
    const first = results[0] || null;
    if (!first) return null;
    const selected = applySelect(first, state.select);
    if (state.lean) return selected;
    return attachInstanceMethods(Model, config, selected);
  }

  const selected = results.map((item) => applySelect(item, state.select));

  if (state.lean) {
    return selected;
  }

  return selected.map((item) => attachInstanceMethods(Model, config, item));
}

async function updateMatching(Model, config, filter, update, options) {
  const items = await scanItems(Model, filter);
  if (!items.length) {
    if (options?.upsert) {
      const base = options?.setDefaultsOnInsert ? applyDefaults({}, config.defaults) : {};
      const merged = applyUpdate({ ...base, ...filter }, update);
      const doc = new Model(merged);
      await doc.save({ isNew: true });
      return options?.returnNew ? doc : null;
    }
    return null;
  }

  const target = normalizeOutput({ ...items[0] }, config.idField);
  const updated = applyUpdate(target, update);
  const doc = new Model(updated);
  await doc.save({ isNew: false });
  return options?.returnNew ? doc : attachInstanceMethods(Model, config, target);
}

async function updateManyInternal(Model, config, filter, update, multi) {
  const items = await scanItems(Model, filter);
  if (!items.length) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  let modifiedCount = 0;

  for (const item of items) {
    const target = normalizeOutput({ ...item }, config.idField);
    const updated = applyUpdate(target, update);
    const doc = new Model(updated);
    await doc.save({ isNew: false });
    modifiedCount += 1;
    if (!multi) {
      break;
    }
  }

  return { matchedCount: items.length, modifiedCount };
}

async function deleteInternal(Model, config, filter, multi) {
  const items = await scanItems(Model, filter);
  if (!items.length) {
    return { deletedCount: 0 };
  }

  let deletedCount = 0;

  for (const item of items) {
    const key = normalizeOutput({ ...item }, config.idField);
    await getDocClient().send(
      new DeleteCommand({
        TableName: Model.tableName,
        Key: { [config.idField]: key[config.idField] },
      })
    );
    deletedCount += 1;
    if (!multi) {
      break;
    }
  }

  return { deletedCount };
}

function applyDefaults(data, defaults) {
  const base = typeof defaults === 'function' ? defaults() : defaults;
  if (!base) return { ...data };
  return deepMerge(base, data);
}

function isValidId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createDynamoModel(config) {
  const modelName = config.modelName;
  const idField = config.idField || '_id';
  const tableName = config.tableName || resolveTableName(modelName);
  const timestamps = config.timestamps !== false;

  class Model {
    constructor(data = {}) {
      Object.assign(this, data);
    }

    static get modelName() {
      return modelName;
    }

    static get tableName() {
      return tableName;
    }

    static get idField() {
      return idField;
    }

    static find(filter = {}) {
      return createQuery(Model, modelConfig, 'find', filter);
    }

    static findOne(filter = {}) {
      return createQuery(Model, modelConfig, 'findOne', filter);
    }

    static findById(id) {
      return createQuery(Model, modelConfig, 'findById', id);
    }

    static async create(data) {
      const merged = applyDefaults(data || {}, modelConfig.defaults);
      const doc = new Model(merged);
      await doc.save({ isNew: true });
      return doc;
    }

    static async updateOne(filter, update) {
      return updateManyInternal(Model, modelConfig, filter, update, false);
    }

    static async updateMany(filter, update) {
      return updateManyInternal(Model, modelConfig, filter, update, true);
    }

    static async findOneAndUpdate(filter, update, options = {}) {
      return updateMatching(Model, modelConfig, filter, update, {
        upsert: options.upsert,
        returnNew: options.new || false,
        setDefaultsOnInsert: options.setDefaultsOnInsert,
      });
    }

    static async findByIdAndUpdate(id, update, options = {}) {
      return Model.findOneAndUpdate({ [idField]: id }, update, options);
    }

    static async deleteOne(filter) {
      return deleteInternal(Model, modelConfig, filter, false);
    }

    static async deleteMany(filter) {
      return deleteInternal(Model, modelConfig, filter, true);
    }

    static async countDocuments(filter = {}) {
      const items = await scanItems(Model, filter);
      return items.length;
    }

    static async exists(filter = {}) {
      const item = await Model.findOne(filter);
      return Boolean(item);
    }
  }

  const modelConfig = {
    modelName,
    idField,
    tableName,
    defaults: config.defaults,
    hiddenFields: config.hiddenFields || [],
    methods: config.methods || {},
    beforeSave: config.beforeSave,
    timestamps,
  };

  Model.prototype.save = async function save(options = {}) {
    const isNew = options.isNew || !this[idField];

    if (isNew && modelConfig.defaults) {
      const merged = applyDefaults(stripFunctions({ ...this }), modelConfig.defaults);
      Object.assign(this, merged);
    }

    if (!this[idField]) {
      this[idField] = generateId();
    }

    this[idField] = normalizeId(this[idField]);
    this._id = this[idField];
    this.id = this[idField];

    if (timestamps) {
      const now = new Date().toISOString();
      if (!this.createdAt) {
        this.createdAt = now;
      }
      this.updatedAt = now;
    }

    if (typeof modelConfig.beforeSave === 'function') {
      await modelConfig.beforeSave(this, { isNew });
    }

    const payload = toPlainItem(this);
    await getDocClient().send(
      new PutCommand({
        TableName: Model.tableName,
        Item: payload,
      })
    );

    return this;
  };

  Model.prototype.deleteOne = async function deleteOne() {
    const id = this[idField];
    if (!id) {
      return { deletedCount: 0 };
    }
    return Model.deleteOne({ [idField]: id });
  };

  Model.prototype.toObject = function toObject() {
    return stripFunctions({ ...this });
  };

  Model.prototype.toJSON = function toJSON() {
    const value = stripFunctions({ ...this });
    const hidden = modelConfig.hiddenFields || [];
    hidden.forEach((field) => {
      delete value[field];
    });
    value.id = value._id || value[idField];
    delete value.__v;
    return value;
  };

  if (modelConfig.methods) {
    Object.entries(modelConfig.methods).forEach(([name, method]) => {
      Model.prototype[name] = method;
    });
  }

  return Model;
}

module.exports = {
  createDynamoModel,
  isValidId,
};
