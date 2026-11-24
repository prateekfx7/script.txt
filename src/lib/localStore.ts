import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface StoredJob {
  id: string;
  fileName: string;
  fileUrl: string;
  sourceType: string;
  status: string;
  errorMsg?: string | null;
  userId?: string | null;
  language?: string | null;
  engine?: string | null;
  starred: boolean;
  createdAt: Date;
}

export interface StoredTranscript {
  id: string;
  jobId: string;
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segments: any;
}

export interface StoredUserCredit {
  id: string;
  userId: string;
  credits: number;
  updatedAt: Date;
}

interface LocalDatabase {
  jobs: StoredJob[];
  transcripts: StoredTranscript[];
  userCredits: StoredUserCredit[];
}

const memoryDb: LocalDatabase = {
  jobs: [],
  transcripts: [],
  userCredits: [],
};

function getStoragePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "scribetxt_db.json");
  }
  return path.join(process.cwd(), ".data", "db.json");
}

function loadDb(): LocalDatabase {
  try {
    const filePath = getStoragePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        jobs: (parsed.jobs || []).map((j: any) => ({
          ...j,
          createdAt: new Date(j.createdAt),
        })),
        transcripts: parsed.transcripts || [],
        userCredits: (parsed.userCredits || []).map((u: any) => ({
          ...u,
          updatedAt: new Date(u.updatedAt),
        })),
      };
    }
  } catch {
    // fallback to memoryDb
  }
  return memoryDb;
}

function saveDb(db: LocalDatabase) {
  memoryDb.jobs = db.jobs;
  memoryDb.transcripts = db.transcripts;
  memoryDb.userCredits = db.userCredits;

  try {
    const filePath = getStoragePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // silently continue with in-memory persistence
  }
}

function generateId(prefix = "cl"): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

export const localStore = {
  job: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async create(args: { data: any }): Promise<StoredJob> {
      const db = loadDb();
      const job: StoredJob = {
        id: args.data.id || generateId("job"),
        fileName: args.data.fileName || "audio.mp3",
        fileUrl: args.data.fileUrl || "direct://upload",
        sourceType: args.data.sourceType || "upload",
        status: args.data.status || "done",
        errorMsg: args.data.errorMsg || null,
        userId: args.data.userId || null,
        language: args.data.language || null,
        engine: args.data.engine || "local",
        starred: Boolean(args.data.starred),
        createdAt: new Date(),
      };
      db.jobs.unshift(job);
      saveDb(db);
      return job;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async findUnique(args: { where: { id?: string }; include?: any }): Promise<any> {
      const db = loadDb();
      const job = db.jobs.find((j) => j.id === args.where.id);
      if (!job) return null;

      if (args.include?.transcript) {
        const transcript = db.transcripts.find((t) => t.jobId === job.id);
        return { ...job, transcript: transcript || null };
      }
      return job;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async findFirst(args: { where?: any; include?: any }): Promise<any> {
      const db = loadDb();
      const job = db.jobs.find((j) => {
        if (!args.where) return true;
        if (args.where.id && j.id !== args.where.id) return false;
        if (args.where.userId && j.userId !== args.where.userId) return false;
        if (args.where.status && j.status !== args.where.status) return false;
        return true;
      });
      if (!job) return null;

      if (args.include?.transcript) {
        const transcript = db.transcripts.find((t) => t.jobId === job.id);
        return { ...job, transcript: transcript || null };
      }
      return job;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async findMany(args?: { where?: any; orderBy?: any; take?: number; skip?: number }): Promise<StoredJob[]> {
      const db = loadDb();
      let list = db.jobs.filter((j) => {
        if (!args?.where) return true;
        if (args.where.userId && j.userId !== args.where.userId) return false;
        if (args.where.status && j.status !== args.where.status) return false;
        if (args.where.sourceType && j.sourceType !== args.where.sourceType) return false;
        return true;
      });
      if (args?.skip) list = list.slice(args.skip);
      if (args?.take) list = list.slice(0, args.take);
      return list;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async update(args: { where: { id: string }; data: any }): Promise<StoredJob | null> {
      const db = loadDb();
      const index = db.jobs.findIndex((j) => j.id === args.where.id);
      if (index === -1) return null;
      db.jobs[index] = { ...db.jobs[index], ...args.data };
      saveDb(db);
      return db.jobs[index];
    },

    async delete(args: { where: { id: string } }): Promise<{ id: string }> {
      const db = loadDb();
      db.jobs = db.jobs.filter((j) => j.id !== args.where.id);
      db.transcripts = db.transcripts.filter((t) => t.jobId !== args.where.id);
      saveDb(db);
      return { id: args.where.id };
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async count(args?: { where?: any }): Promise<number> {
      const db = loadDb();
      if (!args?.where) return db.jobs.length;
      return db.jobs.filter((j) => {
        if (args.where.userId && j.userId !== args.where.userId) return false;
        if (args.where.status && j.status !== args.where.status) return false;
        return true;
      }).length;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async groupBy(args: { by: string[] }): Promise<any[]> {
      const db = loadDb();
      const counts: Record<string, number> = {};
      for (const j of db.jobs) {
        const val = (j as any)[args.by[0]] || "unknown";
        counts[val] = (counts[val] || 0) + 1;
      }
      return Object.entries(counts).map(([k, v]) => ({
        [args.by[0]]: k,
        _count: { _all: v },
      }));
    },
  },

  transcript: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async create(args: { data: any }): Promise<StoredTranscript> {
      const db = loadDb();
      const transcript: StoredTranscript = {
        id: args.data.id || generateId("trans"),
        jobId: args.data.jobId,
        text: args.data.text || "",
        segments: args.data.segments || [],
      };
      // Replace existing transcript for same jobId if present
      db.transcripts = db.transcripts.filter((t) => t.jobId !== transcript.jobId);
      db.transcripts.unshift(transcript);
      saveDb(db);
      return transcript;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async findUnique(args: { where: { jobId?: string; id?: string }; include?: any }): Promise<any> {
      const db = loadDb();
      const transcript = db.transcripts.find(
        (t) => (args.where.jobId && t.jobId === args.where.jobId) || (args.where.id && t.id === args.where.id)
      );
      if (!transcript) return null;

      if (args.include?.job) {
        const job = db.jobs.find((j) => j.id === transcript.jobId);
        return { ...transcript, job: job || null };
      }
      return transcript;
    },

    async deleteMany(args: { where: { jobId?: string } }): Promise<{ count: number }> {
      const db = loadDb();
      const initial = db.transcripts.length;
      if (args.where.jobId) {
        db.transcripts = db.transcripts.filter((t) => t.jobId !== args.where.jobId);
      }
      saveDb(db);
      return { count: initial - db.transcripts.length };
    },
  },

  userCredit: {
    async findUnique(args: { where: { userId: string } }): Promise<StoredUserCredit | null> {
      const db = loadDb();
      return db.userCredits.find((u) => u.userId === args.where.userId) || null;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async upsert(args: { where: { userId: string }; update: any; create: any }): Promise<StoredUserCredit> {
      const db = loadDb();
      const index = db.userCredits.findIndex((u) => u.userId === args.where.userId);
      if (index !== -1) {
        db.userCredits[index] = {
          ...db.userCredits[index],
          ...args.update,
          updatedAt: new Date(),
        };
        saveDb(db);
        return db.userCredits[index];
      }
      const record: StoredUserCredit = {
        id: generateId("uc"),
        userId: args.where.userId,
        credits: args.create.credits || 0,
        updatedAt: new Date(),
      };
      db.userCredits.push(record);
      saveDb(db);
      return record;
    },
  },
};
