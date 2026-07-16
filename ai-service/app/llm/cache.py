import os
import hashlib
import logging
from typing import Optional, Type, TypeVar
from pydantic import BaseModel
from ..telemetry import record_cache

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

# In-memory local cache
_local_cache: dict[str, str] = {}
_redis_client = None

# Optional Redis support
redis_url = os.getenv("REDIS_URL")
if redis_url:
    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        logger.info("[Cache] Redis cache initialized.")
    except ImportError:
        logger.info("[Cache] 'redis' library not installed. Falling back to in-memory cache.")
    except Exception as e:
        logger.warning("[Cache] Failed to initialize Redis client: %s", str(e))


def _get_cache_key(system_instruction: str, contents: str, schema_name: str) -> str:
    payload = f"{system_instruction}|||{contents}|||{schema_name}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def get_cached_response(
    system_instruction: str,
    contents: str,
    response_schema: Type[T],
) -> Optional[T]:
    """Retrieve and deserialize a cached response if present."""
    key = _get_cache_key(system_instruction, contents, response_schema.__name__)
    
    # 1. Try Redis if available
    if _redis_client:
        try:
            cached_json = _redis_client.get(key)
            if cached_json:
                val = response_schema.model_validate_json(cached_json)
                record_cache(hit=True)
                logger.info("[Cache Hit] (Redis) Found cached response for key %s", key)
                return val
        except Exception as e:
            logger.warning("[Cache] Redis read failed: %s", str(e))

    # 2. Try In-memory cache
    cached_json = _local_cache.get(key)
    if cached_json:
        try:
            val = response_schema.model_validate_json(cached_json)
            record_cache(hit=True)
            logger.info("[Cache Hit] (In-Memory) Found cached response for key %s", key)
            return val
        except Exception as e:
            logger.warning("[Cache] Failed to validate cached JSON: %s", str(e))
            _local_cache.pop(key, None)

    record_cache(hit=False)
    return None


async def set_cached_response(
    system_instruction: str,
    contents: str,
    response_schema: Type[T],
    value: T,
) -> None:
    """Serialize and store a response in the cache."""
    key = _get_cache_key(system_instruction, contents, response_schema.__name__)
    try:
        json_str = value.model_dump_json()
        
        # Write to In-memory cache
        _local_cache[key] = json_str
        
        # Write to Redis if available (with 1 day TTL / 86400 seconds)
        if _redis_client:
            try:
                _redis_client.set(key, json_str, ex=86400)
            except Exception as e:
                logger.warning("[Cache] Redis write failed: %s", str(e))
    except Exception as e:
        logger.warning("[Cache] Failed to serialize Pydantic model: %s", str(e))
