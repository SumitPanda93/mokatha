-- ============================================================
-- Mo Katha — Supabase Schema + Seed Data
-- Run this entire file in your Supabase SQL Editor (once)
-- ============================================================

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  "displayName" TEXT NOT NULL DEFAULT '',
  "avatarUrl" TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  location TEXT,
  language TEXT DEFAULT 'or',
  verified BOOLEAN DEFAULT FALSE,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  "isAdmin" BOOLEAN DEFAULT FALSE,
  suspended BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  "authorId" TEXT REFERENCES users(id),
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  "audioUrl" TEXT,
  "coverUrl" TEXT,
  "durationSec" INTEGER,
  language TEXT DEFAULT 'or',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  "tipsTotal" INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  "accessType" TEXT DEFAULT 'free',
  "minTip" INTEGER DEFAULT 0
);
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS post_likes (
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  "postId" TEXT REFERENCES posts(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY ("userId", "postId")
);
ALTER TABLE post_likes DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  "postId" TEXT REFERENCES posts(id) ON DELETE CASCADE,
  "authorId" TEXT REFERENCES users(id),
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0
);
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS mehfils (
  id TEXT PRIMARY KEY,
  "hostId" TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  "isLive" BOOLEAN DEFAULT FALSE,
  listeners INTEGER DEFAULT 0,
  "startsAt" TIMESTAMPTZ DEFAULT NOW(),
  "coverUrl" TEXT DEFAULT '',
  language TEXT DEFAULT 'or',
  tags TEXT[] DEFAULT '{}'
);
ALTER TABLE mehfils DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tips (
  id TEXT PRIMARY KEY,
  "fromUserId" TEXT REFERENCES users(id),
  "toUserId" TEXT REFERENCES users(id),
  "postId" TEXT REFERENCES posts(id),
  "mehfilId" TEXT REFERENCES mehfils(id),
  amount INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tips DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "counterpartyId" TEXT,
  note TEXT
);
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  "actorId" TEXT REFERENCES users(id),
  "targetId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  reason TEXT NOT NULL,
  "reporterId" TEXT REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin_logs DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS follows (
  "followerId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  "followeeId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY ("followerId", "followeeId")
);
ALTER TABLE follows DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wallet_balances (
  "userId" TEXT PRIMARY KEY REFERENCES users(id),
  balance INTEGER DEFAULT 0
);
ALTER TABLE wallet_balances DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS saved_posts (
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  "postId" TEXT REFERENCES posts(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY ("userId", "postId")
);
ALTER TABLE saved_posts DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  "participantIds" TEXT[] NOT NULL,
  "lastMessageAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  "senderId" TEXT REFERENCES users(id),
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS author_plans (
  "authorId" TEXT PRIMARY KEY REFERENCES users(id),
  enabled BOOLEAN DEFAULT FALSE,
  "priceMonthly" INTEGER DEFAULT 99,
  benefits TEXT[] DEFAULT '{}'
);
ALTER TABLE author_plans DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  "authorId" TEXT REFERENCES users(id),
  "userId" TEXT REFERENCES users(id),
  "startDate" TIMESTAMPTZ DEFAULT NOW(),
  "expiryDate" TIMESTAMPTZ,
  status TEXT DEFAULT 'active'
);
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ink_rewards (
  "userId" TEXT PRIMARY KEY REFERENCES users(id),
  points INTEGER DEFAULT 0,
  "streakDays" INTEGER DEFAULT 0,
  "lastClaimDate" TEXT DEFAULT '',
  badges TEXT[] DEFAULT '{}',
  "unlockedPostIds" TEXT[] DEFAULT '{}'
);
ALTER TABLE ink_rewards DISABLE ROW LEVEL SECURITY;

-- ─── Enable Realtime ──────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE mehfils;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ─── Seed Data ────────────────────────────────────────────────────────────────

INSERT INTO users (id, handle, "displayName", "avatarUrl", bio, location, language, verified, followers, following, "isAdmin") VALUES
('u1','ipsita.writes','Ipsita Das','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces','Writes in the stillness between trains. Lives near the sea.','Bhubaneswar','or',TRUE,1248,24,FALSE),
('admin1','admin','Anita Mohanty','https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces','Platform Administrator',NULL,'or',TRUE,9999,1,TRUE),
('u2','manas.live','Manas Kumar Sahoo','https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces','Hosts ghazal evenings under the moon.','Cuttack','or',TRUE,4820,89,FALSE),
('u3','ashutosh.p','Ashutosh Pradhan','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces','Essays the rain forgot to write.','Puri','or',FALSE,622,41,FALSE),
('u4','sanjukta.r','Sanjukta Rout','https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces','Poems for the kitchen window.','Raipur','hi',TRUE,3140,220,FALSE),
('u5','debashis.k','Debashis Kar','https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&crop=faces','Reels from a slow village morning.','Sambalpur','or',FALSE,980,130,FALSE),
('u6','rachita.t','Rachita Tripathy','https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces','Stories the grandmother almost told.','Berhampur','hi',TRUE,2210,60,FALSE),
('u7','biswajit.s','Biswajit Sahoo','https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop&crop=faces','Walks Cuttack at 4 AM and writes what he hears.','Cuttack','or',FALSE,412,70,FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO posts (id, kind, "authorId", title, body, "coverUrl", "audioUrl", "durationSec", language, "createdAt", likes, comments, "tipsTotal", tags, "accessType", "minTip") VALUES
('p1','text','u3','Letters I never sent','ବର୍ଷା ପରେ ଏକ ପ୍ରକାର ନୀରବତା ଆସେ —\nଏହା ଖାଲି ନୁହେଁ, ଭର୍ତ୍ତି ଅସମାପ୍ତ ଶବ୍ଦରେ।\nଯାହା ତୁମେ କହି ନ ପାରିଲ, ସେସବୁ ଏଠି ବସିଛନ୍ତି।','https://images.unsplash.com/photo-1473445361085-b9a07f55608b?w=800',NULL,NULL,'or',NOW()-INTERVAL'6 hours',856,88,420,'{"reflection","longing","monsoon"}','free',0),
('p2','voice','u4','ଶୁଭ ସକାଳ, ଚାନ୍ଦନୀ','ସମୁଦ୍ର ଯେତିକି ବଡ଼ ହେଉ, ଶୁଭ ସକାଳ ଗୋଟିଏ ଚାନ୍ଦନୀ ପାଇଁ ଯଥେଷ୍ଟ।','https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800','/audio/mock-1.mp3',184,'or',NOW()-INTERVAL'2 days',1240,134,1180,'{"voice","morning","sea"}','tip',20),
('p3','story','u6','ଦାଦୀ ର ଚୁପ୍ ରହିବାର କଥା','एक रात दादी ने कहा कि कुछ बातें कहने के बाद अधूरी रह जाती हैं — और कुछ ना कहने पर पूरी हो जाती हैं।\n\nवो रसोई में बैठी थीं। चूल्हे की रौशनी उनके चेहरे पर थी।','https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',NULL,NULL,'hi',NOW()-INTERVAL'1 day 3 hours',412,52,320,'{"story","grandmother","kitchen"}','premium',0),
('p4','voice','u2','ସଂଧ୍ୟାର ଗଜଲ','ଚାଲ, ଆଜି ଚୁପ୍ ରୁହିବା — ଶୁଣିବାକୁ ଅଛି ଅନେକ କିଛି।','https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800','/audio/mock-2.mp3',247,'or',NOW()-INTERVAL'12 hours',980,91,760,'{"ghazal","evening"}','free',0),
('p5','reel','u5','ଗାଁର ଚା ଦୋକାନ','ଚା ଭର୍ତ୍ତି ହେଉଛି, ବଚନ ଖାଲି ହେଉଛି।','https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800','/audio/mock-3.mp3',38,'or',NOW()-INTERVAL'2 hours',2310,220,540,'{"reel","village","tea"}','free',0),
('p6','text','u1','ତୁମ ନାମ','ତୁମ ନାମ ଲେଖିଲେ କାଗଜ ଚମକି ଉଠେ —\nଯେମିତି ଶବ୍ଦ ନୁହଁ, ଗୋଟିଏ ଦୀପ ଲେଖିଲି।','https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800',NULL,NULL,'or',NOW()-INTERVAL'3 days',540,47,220,'{"love","name"}','free',0),
('p7','voice','u7','ଚାରିଟା ର କଟକ','ସହର ଶୁଣା ପଡୁଛି ତା ନିଜ ସ୍ୱରରେ — ଯେତେବେଳେ କେହି ଶୁଣୁ ନ ଥାଆନ୍ତି।','https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800','/audio/mock-4.mp3',312,'or',NOW()-INTERVAL'4 days',320,34,140,'{"city","dawn","cuttack"}','free',0),
('p8','story','u4','रसोई की खिड़की','खिड़की के बाहर एक चिड़िया हर सुबह आती थी। उसका नाम तो नहीं रखा हमने, पर उसकी आदत रख ली।','https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800',NULL,NULL,'hi',NOW()-INTERVAL'5 days',670,71,410,'{"story","kitchen","bird"}','tip',10),
('p9','reel','u4','वक़्त की रसोई','सब कुछ पकता है — वक़्त के अलावा।','https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800','/audio/mock-5.mp3',42,'hi',NOW()-INTERVAL'1 hour',1820,165,380,'{"reel","kitchen","time"}','free',0),
('p10','text','u6','চিঠি','तुम्हें भेजने के लिए जो लिखा था, वो खुद को पढ़ कर रख लिया।','https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',NULL,NULL,'hi',NOW()-INTERVAL'6 days',290,24,90,'{"letter","memory"}','free',0),
('p11','voice','u1','ସମୁଦ୍ର ର ଶିକ୍ଷା','ସମୁଦ୍ର ଶିଖାଏ — ଯିବା ଆଉ ଆସିବା ଗୋଟିଏ କଥା।','https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800','/audio/mock-6.mp3',198,'or',NOW()-INTERVAL'7 days',412,38,180,'{"sea","lesson"}','premium',0),
('p12','story','u3','ବର୍ଷା ର ତିନି ଦିନ','ସେହି ତିନି ଦିନ ଆମେ ବାହାରକୁ ଗଲୁ ନାହିଁ। କଥା କହିଲୁ, ଚା ପିଇଲୁ, ଆଉ ବର୍ଷା ଶୁଣିଲୁ।','https://images.unsplash.com/photo-1438449805896-28a666819a20?w=800',NULL,NULL,'or',NOW()-INTERVAL'8 days',510,45,240,'{"story","rain","memory"}','free',0),
('p13','reel','u2','गली का गाना','गली से जो आवाज़ आ रही है, वो किसी का बचपन है।','https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800','/audio/mock-7.mp3',55,'hi',NOW()-INTERVAL'3 hours',1410,120,290,'{"reel","street","song"}','free',0),
('p14','text','u7','ଖାଲି ଚାନ୍ଦ','ଖାଲି ଚାନ୍ଦ ଆକାଶରେ —\nଖାଲି କଥା ମନରେ।\nଦୁଇଟି ଯାକ ସମ୍ପୂର୍ଣ୍ଣ।','https://images.unsplash.com/photo-1532978879514-6cb1f0c39915?w=800',NULL,NULL,'or',NOW()-INTERVAL'2 days 4 hours',380,29,110,'{"moon","night"}','free',0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO comments (id, "postId", "authorId", body, "createdAt", likes) VALUES
('c1','p1','u4','ଏ ଲେଖା ଭିତରେ ବର୍ଷା ଅଛି।',NOW()-INTERVAL'4 hours',12),
('c2','p1','u2','ଅଶୋତ୍ତର ଚୁପ୍ ର ସ୍ୱର।',NOW()-INTERVAL'3 hours',8),
('c3','p1','u6','बार-बार पढ़ रही हूँ।',NOW()-INTERVAL'2 hours',21),
('c4','p2','u3','ସକାଳ ସତରେ ଆସିଲା।',NOW()-INTERVAL'1 day',18),
('c5','p2','u1','ତୁମ ସ୍ୱର ସମୁଦ୍ର ପରି।',NOW()-INTERVAL'1 day 2 hours',30),
('c6','p3','u2','दादी की चुप्पी सबसे लम्बी कहानी है।',NOW()-INTERVAL'1 day',14),
('c7','p3','u5','अधूरी ही पूरी।',NOW()-INTERVAL'18 hours',11),
('c8','p4','u1','ଆଜି ସଂଧ୍ୟା ଜମିଲା।',NOW()-INTERVAL'8 hours',9),
('c9','p4','u6','ये मेहफिल याद रहेगी।',NOW()-INTERVAL'5 hours',16),
('c10','p5','u7','ଗାଁ ର ଚା ଦୋକାନ ବହୁତ ମନେ ପଡ଼ୁଛି।',NOW()-INTERVAL'1 hour',22),
('c11','p6','u4','ଶବ୍ଦ ନୁହଁ, ଦୀପ — ଠିକ୍।',NOW()-INTERVAL'2 days',19),
('c12','p6','u3','ଏ ଗୋଟିଏ ଲାଇନ୍ ଯଥେଷ୍ଟ।',NOW()-INTERVAL'2 days 4 hours',25),
('c13','p7','u5','ସହର ର ସ୍ୱର ଏଇ ତ।',NOW()-INTERVAL'3 days',8),
('c14','p8','u1','वो चिड़िया हम सब के पास होती है।',NOW()-INTERVAL'4 days',14),
('c15','p8','u3','धीमी, सुंदर।',NOW()-INTERVAL'4 days 6 hours',7),
('c16','p9','u2','इतनी छोटी रील में इतना कुछ।',NOW()-INTERVAL'1 hour',17),
('c17','p10','u4','खुद को पढ़ने वाली पंक्ति।',NOW()-INTERVAL'5 days',10),
('c18','p11','u6','ସମୁଦ୍ର ଆଉ ଗୁରୁ — ଦୁଇ ଯାକ।',NOW()-INTERVAL'6 days',13),
('c19','p12','u4','ତିନି ଦିନ ର ଶାନ୍ତି।',NOW()-INTERVAL'7 days',9),
('c20','p13','u1','गली से बचपन — कितना सही।',NOW()-INTERVAL'2 hours',16),
('c21','p14','u3','ଚୁପ୍ ଚୁପ୍ ସୁନ୍ଦର।',NOW()-INTERVAL'2 days',11),
('c22','p1','u5','ବର୍ଷା ର ଗନ୍ଧ ଆସୁଛି।',NOW()-INTERVAL'1 hour',6),
('c23','p2','u7','ଚାନ୍ଦନୀ ପାଇଁ ଗୀତ।',NOW()-INTERVAL'8 hours',14),
('c24','p3','u4','हर लाइन में चूल्हा है।',NOW()-INTERVAL'12 hours',12),
('c25','p4','u3','ଆଉ ଥରେ ଗାଅ।',NOW()-INTERVAL'7 hours',10),
('c26','p5','u1','ଚା ଭର୍ତ୍ତି ବଚନ ଖାଲି।',NOW()-INTERVAL'1 hour',8),
('c27','p6','u7','ତୁମ ନାମ ଲେଖିଲେ ଦୀପ ଜଳେ।',NOW()-INTERVAL'2 days 6 hours',13),
('c28','p9','u3','रसोई का दर्शन।',NOW()-INTERVAL'1 hour',11),
('c29','p13','u6','गली में पुराना घर है।',NOW()-INTERVAL'1 hour',9),
('c30','p11','u2','ଯିବା ଆଉ ଆସିବା — ଠିକ୍।',NOW()-INTERVAL'7 days',8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO mehfils (id, "hostId", title, description, "isLive", listeners, "startsAt", "coverUrl", language, tags) VALUES
('m1','u2','An evening of ghazals','ସଂଧ୍ୟା ର ଗଜଲ — chai, candles, conversations.',TRUE,184,NOW(),'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800','or','{"ghazal","evening","live"}'),
('m2','u6','किस्से दादी के','Stories the grandmother almost told. Hindi, slow paced.',FALSE,0,NOW()-INTERVAL'1 day','https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800','hi','{"story","grandmother"}'),
('m3','u4','ରସୋଇ ର କବିତା','Poems from the kitchen window. Open mic.',FALSE,0,NOW()-INTERVAL'2 days','https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800','or','{"kitchen","open-mic"}'),
('m4','u1','ସମୁଦ୍ର ର ସମ୍ଭାଷଣ','Sea-side conversations. Bring a poem.',FALSE,0,NOW()-INTERVAL'3 days','https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800','or','{"sea","conversation"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transactions (id, "userId", kind, amount, status, "createdAt", "counterpartyId", note) VALUES
('t1','u1','earning',420,'completed',NOW()-INTERVAL'4 hours','u4','Tips on Letters I never sent'),
('t2','u1','tip-received',150,'completed',NOW()-INTERVAL'1 day','u2',NULL),
('t3','u1','tip-sent',50,'completed',NOW()-INTERVAL'1 day 6 hours','u6',NULL),
('t4','u1','earning',1180,'completed',NOW()-INTERVAL'2 days','u3','Subscription supporters'),
('t5','u1','withdraw',5000,'completed',NOW()-INTERVAL'4 days',NULL,'UPI to ipsita@upi'),
('t6','u1','earning',760,'completed',NOW()-INTERVAL'5 days','u2',NULL),
('t7','u1','tip-received',200,'completed',NOW()-INTERVAL'6 days','u5',NULL),
('t8','u1','tip-sent',100,'completed',NOW()-INTERVAL'6 days 4 hours','u7',NULL),
('t9','u1','earning',320,'completed',NOW()-INTERVAL'7 days','u4',NULL),
('t10','u1','withdraw',2500,'pending',NOW()-INTERVAL'12 hours',NULL,'UPI to ipsita@upi'),
('t11','u1','tip-received',90,'completed',NOW()-INTERVAL'8 days','u3',NULL),
('t12','u1','earning',540,'completed',NOW()-INTERVAL'9 days','u5',NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, kind, "actorId", "targetId", "recipientId", body, "createdAt", read) VALUES
('n1','tip','u4','p1','u1','tipped you ₹150 on Letters I never sent',NOW()-INTERVAL'1 hour',FALSE),
('n2','follow','u3','u1','u1','started following you',NOW()-INTERVAL'2 hours',FALSE),
('n3','reaction','u2','p6','u1','loved your poem ତୁମ ନାମ',NOW()-INTERVAL'3 hours',FALSE),
('n4','mehfil-start','u2','m1','u1','started a Mehfil — An evening of ghazals',NOW()-INTERVAL'0 hours',FALSE),
('n5','mention','u6','p1','u1','mentioned you in a comment',NOW()-INTERVAL'5 hours',TRUE),
('n6','tip','u5','p11','u1','tipped you ₹50',NOW()-INTERVAL'1 day',TRUE),
('n7','reaction','u7','p1','u1','loved your essay Letters I never sent',NOW()-INTERVAL'1 day 4 hours',TRUE),
('n8','follow','u5','u1','u1','started following you',NOW()-INTERVAL'2 days',TRUE),
('n9','tip','u3','p6','u1','tipped you ₹120',NOW()-INTERVAL'2 days 6 hours',TRUE),
('n10','reaction','u4','p11','u1','loved your voice ସମୁଦ୍ର ର ଶିକ୍ଷା',NOW()-INTERVAL'3 days',TRUE),
('n11','mehfil-start','u4','m3','u1','scheduled a Mehfil — ରସୋଇ ର କବିତା',NOW()-INTERVAL'3 days 4 hours',TRUE),
('n12','follow','u6','u1','u1','started following you',NOW()-INTERVAL'4 days',TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO reports (id, kind, "targetId", reason, "reporterId", status, "createdAt") VALUES
('r1','post','p13','Inappropriate audio','u3','pending',NOW()-INTERVAL'4 hours'),
('r2','user','u7','Spam comments','u6','pending',NOW()-INTERVAL'1 day'),
('r3','mehfil','m1','Off-topic discussion','u5','pending',NOW()-INTERVAL'1 hour'),
('r4','post','p9','Misuse of hashtags','u7','resolved',NOW()-INTERVAL'3 days'),
('r5','post','p10','Possible plagiarism','u2','resolved',NOW()-INTERVAL'5 days'),
('r6','user','u5','Repeated low-quality posts','u4','dismissed',NOW()-INTERVAL'7 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_logs (id, "actorId", action, target, "createdAt") VALUES
('al1','admin1','verified user','u4',NOW()-INTERVAL'2 hours'),
('al2','admin1','resolved report','r4',NOW()-INTERVAL'3 days'),
('al3','admin1','approved post','p9',NOW()-INTERVAL'3 days 2 hours'),
('al4','admin1','suspended user','u7',NOW()-INTERVAL'4 days'),
('al5','admin1','ended mehfil','m4',NOW()-INTERVAL'5 days'),
('al6','admin1','approved payout','t5',NOW()-INTERVAL'4 days 6 hours'),
('al7','admin1','verified user','u6',NOW()-INTERVAL'6 days'),
('al8','admin1','dismissed report','r6',NOW()-INTERVAL'7 days'),
('al9','admin1','updated commission','settings',NOW()-INTERVAL'8 days'),
('al10','admin1','enabled auto-moderation','ai',NOW()-INTERVAL'9 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO follows ("followerId", "followeeId", "createdAt") VALUES
('u1','u2',NOW()-INTERVAL'10 days'),('u1','u4',NOW()-INTERVAL'10 days'),('u1','u6',NOW()-INTERVAL'10 days'),('u1','u3',NOW()-INTERVAL'10 days'),
('u2','u1',NOW()-INTERVAL'10 days'),('u3','u1',NOW()-INTERVAL'10 days'),('u4','u1',NOW()-INTERVAL'10 days'),('u5','u1',NOW()-INTERVAL'10 days'),('u6','u1',NOW()-INTERVAL'10 days'),('u7','u1',NOW()-INTERVAL'10 days'),
('u2','u4',NOW()-INTERVAL'10 days'),('u4','u2',NOW()-INTERVAL'10 days'),('u3','u4',NOW()-INTERVAL'10 days'),('u5','u2',NOW()-INTERVAL'10 days'),('u6','u4',NOW()-INTERVAL'10 days'),
('u7','u3',NOW()-INTERVAL'10 days'),('u3','u6',NOW()-INTERVAL'10 days'),('u6','u2',NOW()-INTERVAL'10 days'),('u2','u6',NOW()-INTERVAL'10 days'),('u4','u6',NOW()-INTERVAL'10 days'),
('u5','u4',NOW()-INTERVAL'10 days'),('u7','u4',NOW()-INTERVAL'10 days'),('u4','u3',NOW()-INTERVAL'10 days'),('u6','u3',NOW()-INTERVAL'10 days'),('u2','u3',NOW()-INTERVAL'10 days')
ON CONFLICT ("followerId","followeeId") DO NOTHING;

INSERT INTO wallet_balances ("userId", balance) VALUES
('u1',18420),('u2',42100),('u3',8400),('u4',26500),('u5',5300),('u6',14200),('u7',2100),('admin1',0)
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO saved_posts ("userId", "postId") VALUES ('u1','p4'),('u1','p9') ON CONFLICT DO NOTHING;

INSERT INTO conversations (id, "participantIds", "lastMessageAt") VALUES
('cv1','{"u1","u2"}',NOW()-INTERVAL'2 hours'),
('cv2','{"u1","u4"}',NOW()-INTERVAL'1 day'),
('cv3','{"u1","u6"}',NOW()-INTERVAL'2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, "conversationId", "senderId", body, "createdAt") VALUES
('msg1','cv1','u2','ଆପଣଙ୍କ ଲେଖା ବହୁତ ସୁନ୍ଦର। ଆଜିର ତୁମ ନାମ ପଢ଼ି ମୋ ଆଖି ଭଲ ହୋଇଗଲା।',NOW()-INTERVAL'4 hours'),
('msg2','cv1','u1','ଧନ୍ୟବାଦ ମାନସ, ତୁମ ଗଜଲ ଅସାଧାରଣ। ଆଜି ରାତ୍ରି ର ମେହଫିଲ ଅପ୍ରତୀମ ଥିଲା।',NOW()-INTERVAL'3 hours'),
('msg3','cv1','u2','ଅନେକ ଧନ୍ୟବାଦ। ଆସ ଥରେ ଏକ ଦ୍ୱୟ ପ୍ରୋଗ୍ରାମ କରିବା।',NOW()-INTERVAL'2 hours'),
('msg4','cv2','u4','ଆଜି ର ରସୋଇ ର କବିତା ରୁ ଅନୁପ୍ରାଣିତ ହୋଇ ଗୋଟିଏ ଲେଖା ଲେଖିଲି।',NOW()-INTERVAL'1 day 3 hours'),
('msg5','cv2','u1','ଦେଖାଅ ଦେଖି। ତୁମ ଲେଖା ହୃଦୟ ଛୁଏ।',NOW()-INTERVAL'1 day 2 hours'),
('msg6','cv2','u4','ଅଚ୍ଛା ଠିକ ଅଛି, ଆଗ ଶେଷ କରୁ।',NOW()-INTERVAL'1 day'),
('msg7','cv3','u6','नमस्ते! आपकी कहानियाँ बहुत प्रभावशाली हैं।',NOW()-INTERVAL'2 days 3 hours'),
('msg8','cv3','u1','शुक्रिया रचिता जी। आपकी दादी वाली कहानी मुझे बहुत पसंद आई।',NOW()-INTERVAL'2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO author_plans ("authorId", enabled, "priceMonthly", benefits) VALUES
('u1',TRUE,99,'{"Exclusive poems before public release","Monthly personal voice note","Early Mehfil access + backstage"}'),
('u2',TRUE,149,'{"Ghazal archives (50+ sessions)","Backstage Mehfil pass","Direct message access"}'),
('u4',TRUE,49,'{"Kitchen poetry collections","Hindi story drafts","Comment priority"}')
ON CONFLICT ("authorId") DO NOTHING;

INSERT INTO subscriptions (id, "authorId", "userId", "startDate", "expiryDate", status) VALUES
('sub1','u2','u1',NOW()-INTERVAL'5 days',NOW()+INTERVAL'25 days','active'),
('sub2','u1','u3',NOW()-INTERVAL'3 days',NOW()+INTERVAL'27 days','active'),
('sub3','u1','u4',NOW()-INTERVAL'10 days',NOW()+INTERVAL'20 days','active'),
('sub4','u4','u1',NOW()-INTERVAL'7 days',NOW()+INTERVAL'23 days','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ink_rewards ("userId", points, "streakDays", "lastClaimDate", badges, "unlockedPostIds") VALUES
('u1',285,7,CURRENT_DATE::TEXT,'{"supporter","top-reader","soul-listener"}','{"p3"}'),
('u2',140,3,CURRENT_DATE::TEXT,'{"supporter"}','{}'),
('u3',95,2,(CURRENT_DATE-1)::TEXT,'{}','{}'),
('u4',320,12,CURRENT_DATE::TEXT,'{"supporter","top-reader","soul-listener"}','{}')
ON CONFLICT ("userId") DO NOTHING;

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Your Mo Katha database is ready!
-- All tables have RLS disabled for development.
-- Enable and configure RLS policies before going to production.
