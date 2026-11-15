import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { QuizShareService } from './quiz-share.service';
import { QuizzesService } from './quizzes.service';
import { ShareQuizFriendDto } from './dto/quiz-share.dto';
import { MAX_QUIZZES_PER_USER } from './quizzes.constants';

const OWNER = 'owner';
const FRIEND = '11111111-1111-4111-8111-111111111111';
const TOKEN = '22222222-2222-4222-8222-222222222222';
const QUIZ_ID = 'src-quiz';
const CREATED = new Date('2026-11-01T10:00:00.000Z');

const QUESTIONS = [
  {
    id: 'q1',
    topic: 'T',
    kind: 'single',
    prompt: 'Which protocol uses link-state?',
    options: ['RIP', 'OSPF'],
    answer: [1],
  },
];

// Quiz de origem como esta na BD (com estatisticas e ligacoes do dono).
const SOURCE = {
  userId: OWNER,
  title: 'OSPF',
  language: 'en',
  secondsPerQuestion: 60,
  topics: ['Routing'],
  questions: QUESTIONS,
  figures: { f1: { w: 1 } },
  generators: ['ospfCost', 'bogus'],
  questionCount: 1,
  stats: { q1: { seen: 4, correct: 4, last: true } },
  lastScorePct: 100,
  areaId: 'area-1',
  taskId: 'task-1',
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const firstArg = (fn: jest.Mock) =>
  (
    fn.mock.calls[0] as [{ data?: Record<string, unknown>; where?: unknown }]
  )[0];

function setup(
  opts: {
    owned?: Record<string, unknown> | null;
    share?: Record<string, unknown> | null;
    copy?: { id: string } | null;
    count?: number;
    friends?: boolean;
    recipientDeleted?: number;
  } = {},
) {
  const prisma = {
    quiz: {
      // ownedQuiz e a copia existente usam findFirst; o mock distingue pelo where.
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          'sourceQuizId' in where
            ? (opts.copy ?? null)
            : opts.owned === undefined
              ? {
                  id: QUIZ_ID,
                  sharedById: null,
                  sourceQuizId: null,
                  share: null,
                }
              : opts.owned,
        ),
      ),
      findMany: jest
        .fn()
        .mockResolvedValue(
          opts.copy ? [{ id: opts.copy.id, sourceQuizId: QUIZ_ID }] : [],
        ),
      findUnique: jest.fn().mockResolvedValue(SOURCE),
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'copy-1' }),
    },
    quizShare: {
      findUnique: jest.fn().mockResolvedValue(opts.share ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'share-1' }),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    quizShareRecipient: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'r1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest
        .fn()
        .mockResolvedValue({ count: opts.recipientDeleted ?? 1 }),
    },
    friendship: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.friends === false ? null : { id: 'f' }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u' }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  );
  const service = new QuizShareService(prisma as unknown as PrismaService);
  return { service, prisma };
}

// Partilha lida por token no add (so ids, sem perguntas).
const ADD_SHARE = { id: 'share-1', quizId: QUIZ_ID, quiz: { userId: OWNER } };

describe('QuizShareService.add', () => {
  it('creates a copy without stats, attempts or links of the owner', async () => {
    const { service, prisma } = setup({ share: ADD_SHARE });
    await expect(service.add('u2', TOKEN)).resolves.toEqual({ id: 'copy-1' });
    const data = firstArg(prisma.quiz.create).data!;
    expect(data).toEqual({
      userId: 'u2',
      title: 'OSPF',
      language: 'en',
      secondsPerQuestion: 60,
      topics: ['Routing'],
      questions: QUESTIONS,
      figures: { f1: { w: 1 } },
      generators: ['ospfCost'],
      questionCount: 1,
      sharedById: OWNER,
      sourceQuizId: QUIZ_ID,
    });
    expect(data).not.toHaveProperty('stats');
    expect(data).not.toHaveProperty('lastScorePct');
    expect(data).not.toHaveProperty('areaId');
    expect(data).not.toHaveProperty('taskId');
    expect(prisma.quizShare.update).toHaveBeenCalledWith({
      where: { id: 'share-1' },
      data: { copyCount: { increment: 1 } },
    });
    expect(firstArg(prisma.quizShareRecipient.updateMany).where).toEqual({
      shareId: 'share-1',
      userId: 'u2',
      addedAt: null,
    });
    // Tranca a linha do user antes de contar (como o import).
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: an existing copy comes back without a new count', async () => {
    const { service, prisma } = setup({
      share: ADD_SHARE,
      copy: { id: 'mine' },
    });
    await expect(service.add('u2', TOKEN)).resolves.toEqual({ id: 'mine' });
    expect(prisma.quiz.create).not.toHaveBeenCalled();
    expect(prisma.quizShare.update).not.toHaveBeenCalled();
  });

  it('gives the owner their own quiz id and makes no copy', async () => {
    const { service, prisma } = setup({ share: ADD_SHARE });
    await expect(service.add(OWNER, TOKEN)).resolves.toEqual({ id: QUIZ_ID });
    expect(prisma.quiz.create).not.toHaveBeenCalled();
    expect(prisma.quizShare.update).not.toHaveBeenCalled();
  });

  it('respects the per-user quiz cap', async () => {
    const { service, prisma } = setup({
      share: ADD_SHARE,
      count: MAX_QUIZZES_PER_USER,
    });
    await expect(service.add('u2', TOKEN)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.quiz.create).not.toHaveBeenCalled();
  });

  it('404s for an unknown or revoked token', async () => {
    const { service } = setup({ share: null });
    await expect(service.add('u2', TOKEN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('QuizShareService.preview', () => {
  const PREVIEW_SHARE = {
    quiz: {
      id: QUIZ_ID,
      userId: OWNER,
      title: 'OSPF',
      questionCount: 1,
      topics: ['Routing'],
      language: 'en',
      generators: ['ospfCost', 'wildcard'],
      user: { name: 'Ana' },
    },
  };

  it('returns only a summary, never questions, answers or figures', async () => {
    const { service, prisma } = setup({ share: PREVIEW_SHARE });
    const out = await service.preview('u2', TOKEN);
    expect(out).toEqual({
      title: 'OSPF',
      ownerName: 'Ana',
      questionCount: 1,
      topics: ['Routing'],
      language: 'en',
      generatorCount: 2,
      isOwner: false,
      addedQuizId: null,
    });
    // Nem sequer le as perguntas ou figuras da BD.
    const select = (
      prisma.quizShare.findUnique.mock.calls[0] as [
        { select: { quiz: { select: Record<string, unknown> } } },
      ]
    )[0].select.quiz.select;
    expect(select).not.toHaveProperty('questions');
    expect(select).not.toHaveProperty('figures');
    expect(select).not.toHaveProperty('stats');
    expect(JSON.stringify(select)).not.toContain('email');
  });

  it('points to the existing copy and flags the owner', async () => {
    const withCopy = setup({ share: PREVIEW_SHARE, copy: { id: 'mine' } });
    expect((await withCopy.service.preview('u2', TOKEN)).addedQuizId).toBe(
      'mine',
    );
    const owner = setup({ share: PREVIEW_SHARE });
    expect(await owner.service.preview(OWNER, TOKEN)).toMatchObject({
      isOwner: true,
      addedQuizId: QUIZ_ID,
    });
  });

  it('404s when there is no share', async () => {
    const { service } = setup({ share: null });
    await expect(service.preview('u2', TOKEN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('QuizShareService owner routes', () => {
  it('only the owner reads or changes a share (404 for others)', async () => {
    const { service, prisma } = setup({ owned: null });
    await expect(service.status('u2', QUIZ_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.enable('u2', QUIZ_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.revoke('u2', QUIZ_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.addFriend('u2', QUIZ_ID, FRIEND),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.removeFriend('u2', QUIZ_ID, 'r1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(firstArg(prisma.quiz.findFirst).where).toEqual({
      id: QUIZ_ID,
      userId: 'u2',
    });
    expect(prisma.quizShare.upsert).not.toHaveBeenCalled();
    expect(prisma.quizShare.deleteMany).not.toHaveBeenCalled();
  });

  it('a received copy cannot be shared', async () => {
    const { service, prisma } = setup({
      owned: {
        id: QUIZ_ID,
        sharedById: 'someone',
        sourceQuizId: 'orig',
        share: null,
      },
    });
    await expect(service.enable(OWNER, QUIZ_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.addFriend(OWNER, QUIZ_ID, FRIEND),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.quizShare.upsert).not.toHaveBeenCalled();
  });

  it('enable creates the share and returns the status without emails', async () => {
    const { service, prisma } = setup();
    prisma.quizShare.findUnique.mockResolvedValue({
      token: TOKEN,
      copyCount: 2,
      createdAt: CREATED,
      recipients: [
        {
          id: 'r1',
          userId: FRIEND,
          addedAt: null,
          createdAt: CREATED,
          user: { name: 'Bea' },
        },
      ],
    });
    const out = await service.enable(OWNER, QUIZ_ID);
    expect(firstArg(prisma.quizShare.upsert)).toMatchObject({
      where: { quizId: QUIZ_ID },
      create: { quizId: QUIZ_ID },
    });
    expect(out).toEqual({
      token: TOKEN,
      copyCount: 2,
      createdAt: CREATED.toISOString(),
      recipients: [
        {
          id: 'r1',
          userId: FRIEND,
          name: 'Bea',
          addedAt: null,
          createdAt: CREATED.toISOString(),
        },
      ],
    });
    expect(
      JSON.stringify(prisma.quizShare.findUnique.mock.calls),
    ).not.toContain('email');
  });

  it('status without a share has a null token', async () => {
    const { service } = setup();
    await expect(service.status(OWNER, QUIZ_ID)).resolves.toEqual({
      token: null,
      copyCount: 0,
      createdAt: null,
      recipients: [],
    });
  });

  it('rejects inviting yourself or a non-friend', async () => {
    const self = setup();
    await expect(
      self.service.addFriend(OWNER, QUIZ_ID, OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
    const stranger = setup({ friends: false });
    await expect(
      stranger.service.addFriend(OWNER, QUIZ_ID, FRIEND),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(stranger.prisma.quizShareRecipient.upsert).not.toHaveBeenCalled();
    expect(stranger.prisma.quizShare.upsert).not.toHaveBeenCalled();
  });

  it('invites a friend idempotently (upsert on share + user)', async () => {
    const { service, prisma } = setup({
      owned: {
        id: QUIZ_ID,
        sharedById: null,
        sourceQuizId: null,
        share: { id: 'share-1' },
      },
    });
    await service.addFriend(OWNER, QUIZ_ID, FRIEND);
    expect(prisma.quizShare.upsert).not.toHaveBeenCalled();
    expect(firstArg(prisma.quizShareRecipient.upsert)).toMatchObject({
      where: { shareId_userId: { shareId: 'share-1', userId: FRIEND } },
      create: { shareId: 'share-1', userId: FRIEND },
      update: {},
    });
  });

  it('revoke deletes only the share of my quiz', async () => {
    const { service, prisma } = setup();
    await service.revoke(OWNER, QUIZ_ID);
    expect(firstArg(prisma.quizShare.deleteMany).where).toEqual({
      quizId: QUIZ_ID,
      quiz: { userId: OWNER },
    });
  });

  it('removing a recipient is scoped to the share of my quiz', async () => {
    const { service, prisma } = setup({ recipientDeleted: 0 });
    await expect(
      service.removeFriend(OWNER, QUIZ_ID, 'other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(firstArg(prisma.quizShareRecipient.deleteMany).where).toEqual({
      id: 'other',
      share: { quizId: QUIZ_ID, quiz: { userId: OWNER } },
    });
  });
});

describe('QuizShareService lists', () => {
  it('shared-with-me lists my rows with the copy id when it exists', async () => {
    const { service, prisma } = setup({ copy: { id: 'mine' } });
    prisma.quizShareRecipient.findMany.mockResolvedValue([
      {
        createdAt: CREATED,
        share: {
          token: TOKEN,
          quizId: QUIZ_ID,
          quiz: {
            title: 'OSPF',
            questionCount: 1,
            topics: ['Routing'],
            user: { name: null },
          },
        },
      },
    ]);
    await expect(service.sharedWithMe('u2')).resolves.toEqual([
      {
        token: TOKEN,
        title: 'OSPF',
        ownerName: '',
        questionCount: 1,
        topics: ['Routing'],
        sharedAt: CREATED.toISOString(),
        addedQuizId: 'mine',
      },
    ]);
    expect(firstArg(prisma.quizShareRecipient.findMany).where).toEqual({
      userId: 'u2',
    });
  });

  it('mine lists only shares of my quizzes', async () => {
    const { service, prisma } = setup();
    prisma.quizShare.findMany.mockResolvedValue([
      {
        quizId: QUIZ_ID,
        token: TOKEN,
        copyCount: 3,
        createdAt: CREATED,
        quiz: { title: 'OSPF' },
        _count: { recipients: 2 },
      },
    ]);
    await expect(service.mine(OWNER)).resolves.toEqual([
      {
        quizId: QUIZ_ID,
        title: 'OSPF',
        token: TOKEN,
        copyCount: 3,
        recipientCount: 2,
        createdAt: CREATED.toISOString(),
      },
    ]);
    expect(firstArg(prisma.quizShare.findMany).where).toEqual({
      quiz: { userId: OWNER },
    });
  });
});

describe('ShareQuizFriendDto', () => {
  it('needs a uuid userId and nothing else', async () => {
    const meta = { type: 'body' as const, metatype: ShareQuizFriendDto };
    await expect(
      pipe.transform({ userId: FRIEND }, meta),
    ).resolves.toBeInstanceOf(ShareQuizFriendDto);
    await expect(pipe.transform({ userId: 'nope' }, meta)).rejects.toThrow();
    await expect(
      pipe.transform({ userId: FRIEND, email: 'x@y.z' }, meta),
    ).rejects.toThrow();
  });
});

describe('QuizzesService share info', () => {
  it('list and get expose sharedBy (name only) and isShared', async () => {
    const row = {
      id: 'q',
      sharedBy: { name: 'Ana' },
      share: { id: 'share-1' },
      figures: {},
      stats: {},
    };
    const prisma = {
      quiz: {
        findMany: jest.fn().mockResolvedValue([row]),
        findFirst: jest.fn().mockResolvedValue(row),
      },
    };
    const service = new QuizzesService(prisma as unknown as PrismaService);
    const [listed] = await service.list('u1');
    expect(listed).toMatchObject({ sharedBy: { name: 'Ana' }, isShared: true });
    expect(listed).not.toHaveProperty('share');
    const got = await service.get('u1', 'q');
    expect(got).toMatchObject({ sharedBy: { name: 'Ana' }, isShared: true });
    expect(got).not.toHaveProperty('share');
    const select = firstArg(prisma.quiz.findMany) as unknown as {
      select: { sharedBy: unknown };
    };
    expect(select.select.sharedBy).toEqual({ select: { name: true } });

    prisma.quiz.findFirst.mockResolvedValue({
      ...row,
      sharedBy: null,
      share: null,
    });
    expect(await service.get('u1', 'q')).toMatchObject({
      sharedBy: null,
      isShared: false,
    });
  });
});
