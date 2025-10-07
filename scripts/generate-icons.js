const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

const icons = {
  'icon16.png': ['iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mNQTX5NEmIY1TCqYfhqAAB2SXMQ7LkbdQAAAABJRU5ErkJggg=='],
  'icon48.png': ['iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAOklEQVR42u3OMQ0AAAgDsPnCHaK5cUE4mlRAUz2vREhISEhISEhISEhISEhISEhISEhISEhISEjozgI+10vifIKcMAAAAABJRU5ErkJggg=='],
  'icon128.png': ['iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAAyUlEQVR42u3RQQ0AAAjEsFOAfwOIwwUy4NFkCtZUjw6LBQAACAAAAQAgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAAIALAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEIAPLQGhBgr0AUsiAAAAAElFTkSuQmCC'],
};

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

for (const [filename, chunks] of Object.entries(icons)) {
  const filepath = path.join(assetsDir, filename);
  const base64 = chunks.join('');
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated ${path.relative(path.join(__dirname, '..'), filepath)} (${buffer.length} bytes)`);
}
