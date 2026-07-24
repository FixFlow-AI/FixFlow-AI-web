import { readFile } from 'fs/promises';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { ddb, table } from '../config/aws.js';
import { PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

// Load environment variables from .env
dotenv.config();

/**
 * Ingestion script to migrate all local JSON data files into DynamoDB tables.
 *
 * Source JSON files:
 *  - backend/data/users.seed.json        -> <prefix>_users
 *  - backend/data/github_scans.json      -> <prefix>_github_scan_jobs, <prefix>_freelancer_skills,
 *                                           <prefix>_freelancer_projects, <prefix>_profile_confidence,
 *                                           <prefix>_profile_snapshots
 *  - backend/data/proposals.json         -> <prefix>_proposals
 *  - backend/data/milestones.json        -> <prefix>_milestones
 *  - backend/data/freelancers.seed.json  -> <prefix>_freelancers / <prefix>_users
 */

async function readJsonFile<T>(relativePath: string): Promise<T | null> {
  try {
    const fullPath = resolve(process.cwd(), relativePath);
    const content = await readFile(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`[ingest] Warning: Could not read ${relativePath}: ${(err as Error).message}`);
    return null;
  }
}

async function batchWriteItems(tableName: string, items: Array<Record<string, any>>) {
  if (items.length === 0) return;
  console.log(`[ingest] Writing ${items.length} items to DynamoDB table: ${tableName}`);
  
  const puts = items.map((Item) => ({ PutRequest: { Item } }));
  for (let i = 0; i < puts.length; i += 25) {
    const chunk = puts.slice(i, i + 25);
    await ddb.send(new BatchWriteCommand({ RequestItems: { [tableName]: chunk } }));
  }
}

async function main() {
  console.log('====================================================');
  console.log('🚀 FixFlowAI DynamoDB Ingestion Pipeline Started');
  console.log(`Region: ${process.env.AWS_REGION || 'ap-south-1'}`);
  console.log(`Table Prefix: ${process.env.DDB_TABLE_PREFIX || 'fixflow'}`);
  console.log('====================================================\n');

  // 1. Ingest Users (users.seed.json)
  const usersDataRaw = await readJsonFile<any>('data/users.seed.json');
  const usersList: any[] = Array.isArray(usersDataRaw)
    ? usersDataRaw
    : usersDataRaw?.users
    ? usersDataRaw.users
    : [];

  if (usersList.length > 0) {
    const formattedUsers = usersList.map((u) => {
      const item: Record<string, any> = {
        userId: u.id || u.userId,
        id: u.id || u.userId,
        email: u.email,
        role: u.role || 'freelancer',
        name: u.name || u.githubUsername || 'User',
        picture: u.picture || '',
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || new Date().toISOString(),
        emailVerified: u.emailVerified ?? true,
      };
      if (u.googleSub) item.googleSub = String(u.googleSub);
      if (u.githubUserId) item.githubUserId = String(u.githubUserId);
      if (u.githubUsername) item.githubUsername = u.githubUsername;
      if (u.githubAccessToken) item.githubAccessToken = u.githubAccessToken;
      if (u.authProvider) item.authProvider = u.authProvider;
      if (u.refreshTokens) item.refreshTokenHashes = (u.refreshTokens || []).map((t: any) => t.hash || t);
      return item;
    });
    await batchWriteItems(table('users'), formattedUsers);
    console.log(`✅ Users ingested: ${formattedUsers.length} records.`);
  }

  // 2. Ingest GitHub Scans (github_scans.json)
  const scansData = await readJsonFile<any>('data/github_scans.json');
  if (scansData) {
    // 2a. Jobs
    if (scansData.jobs) {
      const jobsList = Object.values(scansData.jobs);
      await batchWriteItems(table('github_scan_jobs'), jobsList as any[]);
      console.log(`✅ GitHub Scan Jobs ingested: ${jobsList.length} records.`);
    }

    // 2b. Skills
    if (scansData.skills) {
      const allSkills: any[] = [];
      for (const [freelancerId, skillsList] of Object.entries<any[]>(scansData.skills)) {
        for (const skill of skillsList) {
          allSkills.push({
            freelancerId,
            skillName: skill.name || skill.skillName,
            name: skill.name,
            category: skill.category || 'other',
            confidence: skill.confidence ?? 85,
            evidence: skill.evidence || [],
            source: skill.source || 'github_scan',
            editable: false,
          });
        }
      }
      await batchWriteItems(table('freelancer_skills'), allSkills);
      console.log(`✅ Freelancer Skills ingested: ${allSkills.length} records.`);
    }

    // 2c. Projects
    if (scansData.projects) {
      const allProjects: any[] = [];
      for (const [freelancerId, projList] of Object.entries<any[]>(scansData.projects)) {
        for (const proj of projList) {
          allProjects.push({
            freelancerId,
            projectId: proj.repoName || proj.projectId,
            repoName: proj.repoName,
            summary: proj.summary || '',
            domain: proj.domain || 'software',
            stack: proj.stack || [],
            stars: proj.stars ?? 0,
            commitShare: proj.commitShare ?? 100,
            lastActiveAt: proj.lastActiveAt || new Date().toISOString(),
            rankScore: proj.rankScore ?? 0,
          });
        }
      }
      await batchWriteItems(table('freelancer_projects'), allProjects);
      console.log(`✅ Freelancer Projects ingested: ${allProjects.length} records.`);
    }

    // 2d. Confidence
    if (scansData.confidence) {
      const confItems: any[] = [];
      for (const [freelancerId, conf] of Object.entries<any>(scansData.confidence)) {
        confItems.push({
          freelancerId,
          ...conf,
          computedAt: new Date().toISOString(),
        });
      }
      await batchWriteItems(table('profile_confidence'), confItems);
      console.log(`✅ Profile Confidence scores ingested: ${confItems.length} records.`);
    }

    // 2e. Snapshots
    if (scansData.snapshots) {
      const snapItems: any[] = [];
      for (const [freelancerId, snap] of Object.entries<any>(scansData.snapshots)) {
        snapItems.push({
          freelancerId,
          ...snap,
        });
      }
      await batchWriteItems(table('profile_snapshots'), snapItems);
      console.log(`✅ Profile Snapshots ingested: ${snapItems.length} records.`);
    }
  }

  // 3. Ingest Proposals (proposals.json)
  const proposalsData = await readJsonFile<any>('data/proposals.json');
  if (proposalsData) {
    const propList = Array.isArray(proposalsData)
      ? proposalsData
      : Array.isArray(proposalsData.proposals)
      ? proposalsData.proposals
      : Object.values(proposalsData);
    await batchWriteItems(table('proposals'), propList as any[]);
    console.log(`✅ Proposals ingested: ${propList.length} records.`);
  }

  // 4. Ingest Milestones (milestones.json)
  const milestonesData = await readJsonFile<any>('data/milestones.json');
  if (milestonesData) {
    const rawList: any[] = Array.isArray(milestonesData)
      ? milestonesData
      : milestonesData.milestones
      ? Object.values(milestonesData.milestones)
      : Object.values(milestonesData);
    
    const mileList = rawList.map((m) => ({
      ...m,
      milestoneId: m.milestoneId || m.id,
      id: m.id || m.milestoneId,
    }));
    await batchWriteItems(table('milestones'), mileList);
    console.log(`✅ Milestones ingested: ${mileList.length} records.`);
  }

  // 5. Ingest Roster Freelancers (freelancers.seed.json + Registered Freelancer Users)
  const freelancersData = await readJsonFile<any>('data/freelancers.seed.json');
  const rawRoster: any[] = Array.isArray(freelancersData)
    ? freelancersData
    : (freelancersData as any)?.freelancers || [];

  const rosterMap = new Map<string, any>();
  for (const f of rawRoster) {
    const fId = f.freelancerId || f.id || f.userId;
    rosterMap.set(fId, { ...f, freelancerId: fId });
  }

  // Backfill registered freelancers from users.seed.json & github_scans.json
  if (usersList.length > 0) {
    for (const u of usersList) {
      if (u.role === 'freelancer') {
        const uId = u.userId || u.id;
        const userSkills = scansData?.skills?.[uId] ? scansData.skills[uId].map((s: any) => s.name || s.skillName) : [];
        const userJob = scansData?.jobs ? Object.values<any>(scansData.jobs).find((j: any) => j.freelancerId === uId) : null;
        const userLangs = userJob?.languages || {};
        const userConf = scansData?.confidence?.[uId]?.score ?? 88;
        const userSnap = scansData?.snapshots?.[uId];

        rosterMap.set(uId, {
          freelancerId: uId,
          id: uId,
          name: u.name || u.githubUsername || 'Lead Developer',
          title: userSnap?.bio || 'Backend Developer | AWS | Open Source contributor',
          skills: userSkills.length > 0 ? userSkills : ['Express', 'Node.js', 'FastAPI', 'Django', 'React', 'PostgreSQL', 'AWS Lambda', 'Docker'],
          githubLanguages: Object.keys(userLangs).length > 0 ? Object.keys(userLangs) : ['Python', 'TypeScript', 'JavaScript', 'HTML'],
          domains: ['backend', 'devops', 'cloud'],
          rateMin: 60,
          rateMax: 150,
          reputationScore: userConf,
          available: true,
          activeEscrows: 0,
          sbtCount: 1,
          githubUsername: u.githubUsername || 'dev-profile',
          email: u.email,
        });
      }
    }
  }

  const completeRoster = Array.from(rosterMap.values());
  if (completeRoster.length > 0) {
    await batchWriteItems(table('freelancers'), completeRoster);
    console.log(`✅ Freelancers Roster ingested: ${completeRoster.length} records (including registered users).`);
  }

  console.log('\n====================================================');
  console.log('🎉 DynamoDB Data Ingestion Completed Successfully!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
