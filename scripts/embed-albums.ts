import 'dotenv/config';
import { embedAlbums } from '@/server/jobs/embedAlbums';

async function main() {
  await embedAlbums();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

