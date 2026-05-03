import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const successColor = '\x1b[32m%s\x1b[0m';
const errorColor = '\x1b[1;31m\x1b[0m';

const envConfig = `
GEMINI_API_KEY=${process.env.GEMINI_API_KEY || 'AIzaSyC8TG4w60KI6aUZg226VBAT37Kfb-wCMB8'}
DATABASE_URL=${process.env.DATABASE_URL || ''}

NODE_ENV=${process.env.NODE_ENV || ''}
PORT=${process.env.PORT || 3000}
CLIENT_URL=${process.env.CLIENT_URL || ''}
SESSION_SECRET=${ process.env.SESSION_SECRET || ''}

JWT_SECRET=${process.env.JWT_SECRET || ''}
`;

const targetPath = path.join(__dirname, '.env');

try {
    fs.writeFileSync(targetPath, envConfig.trim());
    console.log(successColor, 'Ficheiro .env gerado com sucesso no backend!');
} catch (err) {
    console.error(errorColor, 'Erro ao gerar o ficheiro .env no backend:', err);
    process.exit(1);
    
}