/**
 * Minimal CRUD verification for current legacy schema.
 * Run: npm run db:verify
 */
import { TimeRangeSpotify, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
  const nguoiDung = await prisma.nguoiDung.upsert({
    where: { spotifyId: 'verify-user-spotify-id' },
    create: {
      spotifyId: 'verify-user-spotify-id',
      tenHienThi: 'Verify User',
      email: 'verify@album-pulse.local',
    },
    update: {},
    select: { id: true },
  });

  const ngheSi = await prisma.ngheSi.upsert({
    where: { spotifyId: 'verify-artist' },
    create: {
      spotifyId: 'verify-artist',
      ten: 'Verify Artist',
    },
    update: {},
    select: { id: true },
  });

  const album = await prisma.album.upsert({
    where: { spotifyId: 'verify-album' },
    create: {
      spotifyId: 'verify-album',
      ten: 'Verify Album',
      ngayPhatHanh: '2024',
      doChinhXacNgay: 'YEAR',
    },
    update: {},
    select: { id: true },
  });

  await prisma.albumNgheSi.upsert({
    where: {
      albumId_ngheSiId: {
        albumId: album.id,
        ngheSiId: ngheSi.id,
      },
    },
    create: {
      albumId: album.id,
      ngheSiId: ngheSi.id,
      viTri: 1,
    },
    update: {
      viTri: 1,
    },
  });

  await prisma.yeuThichAlbum.upsert({
    where: {
      nguoiDungId_albumId: {
        nguoiDungId: nguoiDung.id,
        albumId: album.id,
      },
    },
    create: {
      nguoiDungId: nguoiDung.id,
      albumId: album.id,
    },
    update: {},
  });

  await prisma.caiDatNguoiDung.upsert({
    where: { nguoiDungId: nguoiDung.id },
    create: {
      nguoiDungId: nguoiDung.id,
      soLuongGoiY: 20,
      timeRangeMacDinh: TimeRangeSpotify.MEDIUM_TERM,
      ngheSiYeuThich: ['Verify Artist'],
      theLoaiYeuThich: ['rock'],
    },
    update: {
      ngheSiYeuThich: ['Verify Artist'],
      theLoaiYeuThich: ['rock'],
    },
  });

  console.log('CRUD verification passed for legacy schema.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
