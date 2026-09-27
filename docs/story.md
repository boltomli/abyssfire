# 渊火 · 故事圣经（Story Bible）

> **English summary.** The world was forged in the **Abyssfire** (渊火), the primordial flame at the bottom of the Abyss; its warmth runs through the land as the **ley lines** (灵脉). Six sages swore to tend it. A thousand years ago, as the ley lines began to cool, the brightest of them, **Ignaroth the Oathburner** (焚誓者·伊格纳罗斯), broke the oath and opened the Abyss to "reforge" the flawed world in the fire: the **Great Cataclysm**. The other five bound him in the deep with **five seals** at the cost of their lives, erased his name (so history only remembers "five sages"), and the warden **Aethelyn**, his sister, stole the purest spark of the fire, the **Heartflame** (心焰), and hid it among mortals. For a millennium Ignaroth has whispered to the ambitious, and one by one the seals broke. Now the fire stirs, and the hero wakes in the ashes of an elven tower bearing a **brand** (渊火烙印): five flames around an empty centre. The prophecy says the bearer "opens the gate and closes it". Across five chapters the hero rekindles the seals, and each lights one flame of the brand. At the gate comes the twist: the seals' souls are both lock and key, so the hero has been carrying Ignaroth's key all along. The finale: the hero forges the Final Key with the Hammer of Fate, defeats Ignaroth's avatar, and freely **gives the Heartflame back** to the Abyssfire. Seized, the fire burns; given, it warms. The ley lines rekindle, Ignaroth understands his sister at last and fades, and the hero survives with a silver ring on the palm and a warm light in its centre. The empty seat is filled, and the hero becomes the new **Flamekeeper** (守火人).

脚本：`src/data/story/script.ts`　文本：`src/i18n/locales/story.ts`　主线任务文本：`src/data/quests/all_quests.ts`、`src/i18n/locales/{zh-CN,en,questStory}.ts`

---

## 一、世界：渊火与灵脉

- **渊火（Abyssfire）**：太初虚空无光，深渊之底燃起一簇火焰，世界自火中锻成：山岳是它冷却的铁，江河是它的淬水。渊火不是恶，它是世界的炉膛。
- **灵脉（Ley Lines）**：渊火的余温沿地底脉络流遍大地，万物因之而生。翡翠平原下的精灵灵脉是连接五地的**枢纽**（见 `lore_ep_04`）。
- **心焰（Heartflame）**：渊火中最纯净的一缕，是渊火"温暖"而非"焚烧"的那一面。心焰被守望者艾瑟琳取走并藏于人间。
- **核心主题**：*火被夺取则焚世，被交还则暖世。*（伊格纳罗斯想"夺火重铸"，主角最终"还火归炉"。）

## 二、历史年表

| 时代 | 事件 |
|---|---|
| 太初 | 渊火锻世，灵脉流布。 |
| 灵脉纪元 | **六贤守火**：精灵贤者艾兰迪尔、月之祭司瑟莲娜、矮人王布鲁恩、日冕女王纳芙莎、守望者艾瑟琳，以及六人中最耀眼的**守火人伊格纳罗斯**。 |
| 千年前 | **焚誓 / 大灾变**：灵脉渐冷，伊格纳罗斯恐惧世界终将熄灭，焚毁誓言、打开深渊，欲将"残缺的世界"投回渊火重铸。火海漫过大地，精灵高塔崩塌，灵脉枢纽断裂。 |
| 千年前 | **五印**：五贤者"以血为锁、以魂为钥"（`lore_ar_04`），将他缚于深渊之底，立下五道封印，各自以命为锚。布鲁恩王以渊火余烬锻出**命运之锤**，再以锤锻印。五贤者凿去了他的名字，后世只知"五贤者"。艾瑟琳取走心焰，藏于平原灵脉枢纽之下；她的血脉成为世代的**深渊守望者**（`lore_ar_02`"第五位守护者的后裔"）。 |
| 数百年前 | **日冕之印（第四道结界）碎**：女王以身为锁后，大祭司继任守印，守到畏惧死亡。低语许他"与火同寿"，他砸碎封印（`lore_sd_02`），日冕王国一夜化为焦土；大祭司化为沙漠亡灵，圣鸟赫莉娅被渊火奴役。游牧民是王国的遗民。 |
| 数百年前 | **月辉之印碎**：一位巫师听信低语，与生命之树融为一体以求永生（`lore_tf_01`），月印被污，森林永坠暮光。月之祭司的精灵守卫堕为暗影织者（`lore_tf_03`），圣狼沃尔甘堕为狼王。 |
| 百年前 | **铁砧之印动摇**：一场"地震"（实为伊格纳罗斯在山底翻身）惊醒石像鬼，矮人弃城；铁甲守卫仍执行最后的命令（`lore_am_02`）；巨魔戈尔姆占据王座，被王座下的封印低语吸引。 |
| 当代 | **渊火复燃**：哥布林萨满在低语驱使下举行仪式，撬动平原的灵脉之印（`lore_ep_02`）。某夜精灵塔废墟火柱冲天：心焰择主，主角于灰烬中醒来。 |

## 三、反派：伊格纳罗斯

- **名号**：伊格纳罗斯（Ignaroth），**焚誓者**（the Oathburner）；昔日称号"守火人"。最终形态：**渊火化身**（`demon_lord`，任务目标名"深渊领主"）。
- **身份**：被抹去名字的**第六位贤者**，艾瑟琳的兄长。守望者对话中"千年前堕落的大魔法师"即是他。
- **动机**：他不是想毁灭世界，而是**不愿看世界熄灭**。灵脉渐冷，他认定世界是"一件铸坏的器物"，要投回渊火重铸成一个"不会冷、不会死、不会有人被遗忘"的永恒世界。讽刺在于：被遗忘的正是他自己。
- **腐化方式："低语"**：被缚深渊的他只能说话。他寻找**畏惧终结、渴求永恒**的人，许以"永生/力量/火的恩赐"：大祭司、巫师、萨满、虚空先驱（第一个签订契约者，`lore_ar_05`）。野兽与巨魔没有心智可谈，他便直接"住进"它们的脑子（狼王、戈尔姆）。
- **对主角的态度**：温和、耐心、近乎慈爱。他称封印为"灯"，称主角"孩子"，鼓励主角"一直走下去"，因为他需要主角把五道火焰带到门前。
- **结局**：化身崩裂后显出苍老人形，认出心焰中妹妹的气息："你还是老样子，宁可把火分给别人。"目睹渊火在"交还"中重燃灵脉，他终于明白"不必焚尽一切，也能重燃"，化为灰烬散去。

## 四、烙印与预言

- **渊火烙印（the Brand）**：掌心印记，**五焰环绕，中央一空**。
  - 五焰 = 五贤者 / 五道封印。每重燃一道封印，对应一焰亮起（翠绿、银白、赤红、金黄、暗银）。
  - 中央之空 = 伊格纳罗斯被凿去的第六座位，其下藏着**心焰**。
- **预言**（刻于精灵塔古碑，村长家族世代守碑）：
  > 渊火再燃之夜，灰烬中将有人醒来。其身负五焰，其心藏一空。
  > 他将行过五地，重燃五印。开门者是他，闭门者亦是他。
- **反转**：封印的锁是五贤者的魂，钥匙也是。主角沿途点亮的五焰，本身就是**开门的钥匙**，伊格纳罗斯一直在"借主角之手"收集它。
- **代价**：艾瑟琳遗言："心焰归渊之时，持焰者将随火而去。"
- **回报**：主角**自愿交还**心焰，不是献给他，而是还给世界。渊火没有吞噬主角，而是回到炉膛、沿灵脉温暖五方。烙印褪为**银环**，环心留一点微光：渊火的谢意，也是新的誓言。空缺的第六座被填满，主角成为新的**守火人**。

## 五、五章结构

主线任务每区 5 个（`category: 'main'`），链式前置不变。下表"过场"指 `STORY_TRIGGERS` 触发的过场动画。

### 第一章 · 灰烬中醒来（翡翠平原，Lv1–10，`dawn`）
- **赌注**：灵脉之印（第一印）被哥布林撬动；村庄的生计。
- **人物**：村长（守碑人后裔，收留主角，温暖的"家"）、碎牙·格罗克（灰烬部落之主）、哥布林萨满（仪式执行者，小Boss）。
- **任务**：史莱姆之灾 → 火光之眼 → 篝火营地 → 碎牙之王 → 灵脉之印。
- **过场**：`cs_ep_mark`（村长认出烙印，念出预言）· `cs_ep_whisper`（梦回营地，第一次低语："哥布林替我叩门，而你，替我点灯"）· `cs_boss_goblin_chief` · `cs_ep_finale`（第一焰亮起，东行入林）。
- **揭示**：烙印与预言；有一个"被抹去名字的人"在火中注视主角。

### 第二章 · 被抹去的名字（暮色森林，Lv10–20，`night`）
- **赌注**：月辉之印被污，亡者不得安息。
- **人物**：侦察兵（干练寡言）、森林隐士（真相的讲述者）、通灵巫女、狼王沃尔甘（噬月之狼，月之祭司的圣狼）、暗影织者（堕落的精灵守卫，小Boss）。
- **任务**：永夜之林 → 不安的亡者 → 被抹去的名字 → 噬月之狼 → 月辉之印。
- **过场**：`cs_tf_hermit`（**大揭示**：六贤非五；伊格纳罗斯其人其动机；心焰选中了你）· `cs_boss_werewolf_alpha` · `cs_tf_finale`（月光落地，第二焰亮起）。

### 第三章 · 命运之锤（铁砧山脉，Lv20–30，`forge`）
- **赌注**：铁砧之印；矮人的故土与尊严。
- **人物**：矮人长老（暴躁而重情）、戈尔姆（王座篡夺者）、铁甲守卫（小Boss，仍执行最后命令）。
- **任务**：沉默的铁砧 → 石翼蔽日 → 先王遗物 → 命运之锤 → 篡座者。
- **过场**：`cs_am_hammer`（熔炉认出主角；重铸命运之锤并交予主角："锤能锻印，也能锻钥匙"）· `cs_boss_mountain_troll` · `cs_am_finale`（铁砧长鸣，第三焰亮起；反派承认曾诱惑大祭司）。

### 第四章 · 日冕余烬（灼热沙漠，Lv30–40，`sand`）
- **赌注**：日冕之印（第四道结界）早已碎裂，火焰裂隙在喂养深渊。
- **人物**：沙漠游牧民（王国遗民，诗意）、赫莉娅（被缚的日冕圣鸟，悲剧而非邪恶）、沙漠亡灵（昔日大祭司，小Boss）。
- **任务**：燃烧的沙海 → 无主之火 → 泉水的记忆 → 吞路之虫 → 日冕之印。
- **过场**：`cs_sd_oasis`（泉水幻象：王国、女王、大祭司的背叛与低语）· `cs_boss_phoenix` · `cs_sd_finale`（赫莉娅浴火重生缝合裂隙，第四焰亮起；中央空缺第一次作痛）。

### 终章 · 渊火（深渊裂隙，Lv40–50，`abyss`）
- **赌注**：最后一道封印、整个世界，以及主角自己的性命。
- **人物**：深渊守望者（艾瑟琳后裔，等待了一生）、堕落骑士、虚空研究者、虚空先驱（小Boss）、伊格纳罗斯。
- **任务**：渊火之门 → 门缝之潮 → 以渊为引 → 终焉之钥 → 焚誓者。
- **过场**：`cs_ar_gate`（**反转**：锁与钥皆为贤者之魂，主角一直在为他收集钥匙；他自报姓名）· `cs_ar_seal`（锻成终焉之钥，第五焰亮起；揭示心焰的代价；主角："我知道。"）· `cs_boss_demon_lord` · `cs_ar_fall`（终局）。

## 六、结局

1. 渊火化身崩裂，伊格纳罗斯显出人形，说出他的恐惧。
2. 主角举掌，五焰齐亮，心焰成形；他认出艾瑟琳。
3. 终焉之钥入门，心焰归渊。渊火平静，暖意沿灵脉送往五方。
4. 伊格纳罗斯："不必焚尽一切，也能重燃……原来，她才是对的。"化灰而散，巨门合拢。
5. 烙印化为银环，环心一点微光。
6. **尾声**（`EPILOGUE`）：五地复苏；村长在古碑上添了一行新字；人们称主角为"守火人"；"渊火从未熄灭，它只是回到了炉膛里。"
7. **字幕**（`CREDITS`）后：深渊之下还有更深的黑暗，噩梦难度在等待（衔接随机地牢中的"深渊之主·卡萨诺尔"，他是伊格纳罗斯倒下后仍在深渊迷宫中徘徊的恶魔君主）。

## 七、写作规范

- 中文为源语言：文学性但易读，善用四字词，不堆砌辞藻；全角标点。
- 反派低语：短句、温柔、笃定，从不咆哮。统一以"灯"指代封印。
- 主角台词极少且短（"……开门，还是闭门？""你是谁？""我知道。""这火，不是你的。"）。
- 长度上限（中文字符）：对白/低语 ≤ 60，旁白 ≤ 70，幻灯片正文 ≤ 110，标题 ≤ 12，称号 ≤ 14；任务 offer ≤ 70，complete ≤ 50。由 `src/__tests__/StoryScript.test.ts` 校验。

## 八、名词表（Glossary）

| 中文 | English | 说明 |
|---|---|---|
| 渊火 | Abyssfire | 深渊之底的太初之火，世界的炉膛 |
| 灵脉 | Ley lines | 渊火余温流经大地的脉络 |
| 心焰 | Heartflame | 渊火最纯净的一缕，藏于主角掌心 |
| 渊火烙印 | The Brand | 五焰环一空 |
| 大灾变 | The Great Cataclysm | 千年前伊格纳罗斯开启深渊 |
| 焚誓 | The Burning of the Oath | 伊格纳罗斯背誓 |
| 六贤 / 五贤者 | The Six / the Five Sages | 守火的六位贤者 / 后世所知的五位 |
| 守火人 | Flamekeeper | 伊格纳罗斯的旧称，结局后主角的称号 |
| 伊格纳罗斯 | Ignaroth | 焚誓者，第六贤者，反派 |
| 焚誓者 | The Oathburner | 伊格纳罗斯的称号 |
| 渊火化身 | Abyssfire Incarnate | 伊格纳罗斯的最终形态（`demon_lord`） |
| 艾瑟琳 | Aethelyn | 守望者，伊格纳罗斯之妹，藏起心焰 |
| 艾兰迪尔 | Elandir | 精灵贤者，灵脉之印 |
| 瑟莲娜 | Selenne | 月之祭司，月辉之印 |
| 布鲁恩 | Bruun | 矮人王，命运之锤，铁砧之印 |
| 纳芙莎 | Nafsha | 日冕女王，日冕之印 |
| 灵脉之印 | Seal of Veins | 第一印，翡翠平原 |
| 月辉之印 | Moon Seal | 第二印，暮色森林 |
| 铁砧之印 | Anvil Seal | 第三印，铁砧山脉 |
| 日冕之印 | Sun Seal | 第四印（第四道结界），灼热沙漠 |
| 渊之印 / 终焉之钥 | Abyss Seal / The Final Key | 第五印 / 以命运之锤锻成的钥匙 |
| 命运之锤 | Hammer of Fate | 锻出五印的神锤 |
| 日冕王国 | Sun Crown Kingdom | 沙漠中覆灭的古国 |
| 混沌王座 / 渊火之门 | Throne of Chaos / Gate of the Abyssfire | 终战之地 |
| 碎牙·格罗克 | Grokk Brokentooth | 灰烬部落之主（`goblin_chief`） |
| 沃尔甘 | Volgan | 噬月之狼（`werewolf_alpha`） |
| 戈尔姆 | Gorm | 王座篡夺者（`mountain_troll`） |
| 赫莉娅 | Helia | 被缚的日冕圣鸟（`phoenix`） |
| 深渊守望者 | Abyss Warden | 艾瑟琳血脉的守门人 |
