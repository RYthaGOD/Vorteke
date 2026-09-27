import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const address = '3jdbFoiZhqk9KdYR8xM1ALgkCBJm3jKk9sZrxc8vpump';
    
    console.log(`Updating banner for: ${address}`);
    
    await prisma.enhancement.update({
        where: { address },
        data: {
            bannerURI: '/images/banners/crude_cash.png'
        }
    });

    console.log('✅ Banner updated successfully.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
