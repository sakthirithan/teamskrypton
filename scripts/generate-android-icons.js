import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceIcon = path.resolve('public/icons/icon-512x512.png');
const resDir = path.resolve('android/app/src/main/res');

const launcherSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const foregroundSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const notificationSizes = {
  'drawable-mdpi': 24,
  'drawable-hdpi': 36,
  'drawable-xhdpi': 48,
  'drawable-xxhdpi': 72,
  'drawable-xxxhdpi': 96,
};

async function generate() {
  console.log('Generating Android App Launcher and Notification Icons...');

  if (!fs.existsSync(sourceIcon)) {
    console.error('Source icon not found:', sourceIcon);
    process.exit(1);
  }

  // 1. Generate Launcher Icons (ic_launcher.png & ic_launcher_round.png)
  for (const [folder, size] of Object.entries(launcherSizes)) {
    const dir = path.join(resDir, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(sourceIcon)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    await sharp(sourceIcon)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`Generated launcher icon ${size}x${size} in ${folder}`);
  }

  // 2. Generate Adaptive Foreground Icons (ic_launcher_foreground.png)
  for (const [folder, size] of Object.entries(foregroundSizes)) {
    const dir = path.join(resDir, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Inner icon size is ~66% of target size for adaptive safe zone
    const innerSize = Math.round(size * 0.66);
    const padding = Math.round((size - innerSize) / 2);

    const innerBuffer = await sharp(sourceIcon)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: innerBuffer, top: padding, left: padding }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Generated adaptive foreground ${size}x${size} in ${folder}`);
  }

  // 3. Generate Notification Small Icons (ic_notification.png - Monochrome White)
  for (const [folder, size] of Object.entries(notificationSizes)) {
    const dir = path.join(resDir, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Create a monochrome white version of the logo for status bar
    const rawLogo = await sharp(sourceIcon)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .toBuffer();

    // Convert non-transparent pixels to white for Android status bar compliance
    await sharp(rawLogo)
      .threshold(10)
      .tint({ r: 255, g: 255, b: 255 })
      .png()
      .toFile(path.join(dir, 'ic_notification.png'));

    console.log(`Generated notification small icon ${size}x${size} in ${folder}`);
  }

  console.log('✅ All Android launcher and notification icons generated successfully!');
}

generate().catch(console.error);
