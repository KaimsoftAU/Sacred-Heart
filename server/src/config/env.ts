import { config } from 'dotenv';

// Load environment variables
config();

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
export const MONGODB_URI = process.env.MONGODB_URI || '';
export const PORT = process.env.PORT || 3000;
