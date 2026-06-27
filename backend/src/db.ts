import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from database folder
dotenv.config({ path: path.resolve(__dirname, '../../database/.env') });

export const prisma = new PrismaClient();
