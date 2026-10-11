import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'resumes');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are accepted for resume upload' },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    // Save file with timestamp to avoid collisions
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${timestamp}_${safeFilename}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      success: true,
      filename: file.name,
      storedFilename: filename,
      filepath: filepath,
      size: buffer.length,
    });
  } catch (error: unknown) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ resumes: [] });
    }

    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const stats = fs.statSync(path.join(UPLOAD_DIR, f));
        // Extract original filename (remove timestamp prefix)
        const originalName = f.replace(/^\d+_/, '');
        return {
          storedFilename: f,
          originalName,
          filepath: path.join(UPLOAD_DIR, f),
          size: stats.size,
          uploadedAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json({ resumes: files });
  } catch (error: unknown) {
    console.error('Error listing resumes:', error);
    return NextResponse.json({ resumes: [] });
  }
}
