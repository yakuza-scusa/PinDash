const { PrismaClient, MembershipRole, PinStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "owner@pindash.local" },
    update: { displayName: "Alex Morgan" },
    create: {
      email: "owner@pindash.local",
      displayName: "Alex Morgan",
      emailVerifiedAt: new Date(),
    },
  });
  const workspace = await prisma.workspace.upsert({
    where: { slug: "atelier-studio" },
    update: { name: "Atelier Studio", defaultTimezone: "Europe/Paris" },
    create: {
      name: "Atelier Studio",
      slug: "atelier-studio",
      defaultTimezone: "Europe/Paris",
      ownerUserId: user.id,
    },
  });
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    update: { role: MembershipRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: MembershipRole.OWNER,
    },
  });
  const existing = await prisma.pinDraft.count({
    where: { workspaceId: workspace.id },
  });
  if (existing === 0) {
    await prisma.pinDraft.createMany({
      data: [
        {
          workspaceId: workspace.id,
          createdByUserId: user.id,
          title: "Home office lighting ideas",
          description:
            "A practical lighting guide for calm and productive home offices.",
          altText: "Bright desk beside a window with a warm task lamp",
          destinationUrl: "https://example.com/home-office-lighting",
          status: PinStatus.DRAFT,
        },
        {
          workspaceId: workspace.id,
          createdByUserId: user.id,
          title: "Indoor herb starter guide",
          description: "Simple herbs that thrive in small kitchens.",
          altText: "Three herb pots on a sunny kitchen shelf",
          destinationUrl: "https://example.com/indoor-herbs",
          status: PinStatus.DRAFT,
        },
        {
          workspaceId: workspace.id,
          createdByUserId: user.id,
          title: "Autumn entryway refresh",
          description: "Warm and practical entryway ideas for autumn.",
          altText: "Neutral entryway decorated with an autumn wreath",
          destinationUrl: "https://example.com/autumn-entryway",
          status: PinStatus.AWAITING_APPROVAL,
        },
      ],
    });
  }
  console.log(`Seeded ${workspace.name} for ${user.email}`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
