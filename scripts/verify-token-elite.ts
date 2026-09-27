import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TOKEN_ADDRESS = '3jdbFoiZhqk9KdYR8xM1ALgkCBJm3jKk9sZrxc8vpump';

async function main() {
    console.log(`Checking status for ${TOKEN_ADDRESS}...`);

    const enhancement = await prisma.enhancement.findUnique({
        where: { address: TOKEN_ADDRESS }
    });

    console.log("\n--- ENHANCEMENT RECORD ---");
    console.log(JSON.stringify(enhancement, null, 2));

    const token = await prisma.token.findUnique({
        where: { address: TOKEN_ADDRESS }
    });

    console.log("\n--- TOKEN RECORD ---");
    console.log(JSON.stringify(token, null, 2));

    await prisma.$disconnect();
}

main();
