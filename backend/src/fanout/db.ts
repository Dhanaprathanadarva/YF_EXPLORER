import mongoose, { Schema, Document } from 'mongoose';

interface IFanoutRecord extends Document {
  query: string;
  key: string;
  depth: number;
  jobType: string;
  path: string[];
  data: object;
  updatedAt: Date;
}

const fanoutRecordSchema = new Schema<IFanoutRecord>({
  query:     { type: String, required: true, lowercase: true },
  key:       { type: String, required: true },
  depth:     { type: Number, required: true },
  jobType:   { type: String, required: true },
  path:      { type: [String], default: [] },
  data:      { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const FanoutRecord = mongoose.model<IFanoutRecord>('FanoutRecord', fanoutRecordSchema);
