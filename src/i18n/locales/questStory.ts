/**
 * Quest story lines — what the quest giver says when offering a quest
 * (`data.quest.<id>.offer`) and when the player turns it in (`.complete`).
 *
 * zh-CN is the source of truth (zh-TW is auto-converted from it).
 */
import type { LocaleData } from '../types';

/** NPC lines for each quest: `.offer` (when offering it) and `.complete` (when the player turns it in). */
export const QUEST_STORY_ZH: LocaleData = {
  // ─── Zone 1: 翡翠平原 — 村长 (main chain) ───
  'data.quest.q_kill_slimes.offer': '你在灰烬里睡了三天，总算醒了。那夜火柱冲天之后，北边湿地的史莱姆就疯长起来。帮老头子清掉十只吧，当心酸液。',
  'data.quest.q_kill_slimes.complete': '田里清静了，谢谢你。……等等，把手伸过来。你掌心这道烙印，我在精灵石碑上见过。',
  'data.quest.q_kill_goblins.offer': '哥布林昨夜又摸进村子了。怪的是，它们眼里都烧着和你烙印一样的火光。去南边狠狠教训它们，也看看那火是哪来的。',
  'data.quest.q_kill_goblins.complete': '它们退了，可眼里的火没灭。猎户说南边深处有座营地，萨满夜夜对着地底跳火。',
  'data.quest.q_explore_goblin_camp.offer': '营地在平原南边深处，篝火七天七夜没灭过，萨满对着地底念咒。去摸摸底，看他们在唤醒什么。千万别逞强。',
  'data.quest.q_explore_goblin_camp.complete': '图腾上刻着灵脉的纹路……它们想撬开平原底下的封印！首领就是那只撬棍。',
  'data.quest.q_find_goblin_chief.offer': '首领叫格罗克，藏在平原西南深处。它向部落许诺，砍下“烙印之手”就能得到火的恩赐。孩子，它要的是你。活着回来。',
  'data.quest.q_find_goblin_chief.complete': '格罗克倒了，部落散了！可我这心还悬着：灵脉还在地底发抖。',
  'data.quest.q_secure_plains.offer': '灵脉还在发抖，我脚底都感觉得到。去东边和南边走一趟吧。碑上说，烙印者所到之处，灵脉自会安宁。',
  'data.quest.q_secure_plains.complete': '地底的颤动停了。第一道封印稳住了……孩子，你手上的火，好像亮了一点。',
  // ─── Zone 1: 翡翠平原 — 支线 ───
  'data.quest.q_collect_slime_gel.offer': '商人托我找个帮手，他调药水离不开史莱姆凝胶。打史莱姆时留意掉下来的凝胶，攒够八份就行。',
  'data.quest.q_collect_slime_gel.complete': '这些凝胶够他熬好几锅药了。你留几瓶药水路上用，别跟我客气。',
  'data.quest.q_herb_gathering.offer': '药师那边伤员躺了一屋子，草药早就见底了。平原西边的草地上有泛着微光的翡翠草药，采五株回来吧。',
  'data.quest.q_herb_gathering.complete': '有了这些草药，伤员们就有救了。你这孩子，心肠真好。',
  'data.quest.q_lost_pendant.offer': '老王家的传家挂坠被哥布林抢走了，老太太哭了一整夜。去东边收拾那些哥布林，挂坠多半在哪个家伙身上。',
  'data.quest.q_lost_pendant.complete': '就是这枚！老太太见了准得高兴坏了。这点心意，你务必收下。',
  'data.quest.q_rare_mushroom.offer': '东北边的湿地里长着会发光的魔力蘑菇，药师肯出高价。采六朵回来，村里这个冬天就好过多了。',
  'data.quest.q_rare_mushroom.complete': '朵朵饱满，品相真好！药师该乐得合不拢嘴了，这是你应得的。',
  'data.quest.q_escort_merchant_plains.offer': '有位商人要去南方营地，可一路上全是哥布林。村里的补给全指望他了，你陪他走一趟，别让他出事。',
  'data.quest.q_escort_merchant_plains.complete': '商人平安到了，还特地托人捎话谢你。一路辛苦了。',
  'data.quest.q_pet_sprite_friend.offer': '平原上住着一只小精灵，最恨史莱姆糟蹋花草。听说谁替它赶走二十只史莱姆，它就愿意跟着谁。',
  'data.quest.q_pet_sprite_friend.complete': '瞧，那小家伙在你肩头转来转去，是认你当朋友啦。好好待它。',

  // ─── Zone 1: 翡翠平原 — 流浪剑客 ───
  'data.quest.q_bandit_trouble.offer': '南边大路上埋伏着一伙哥布林，专劫过往商队。我曾发誓守护这样的道路……如今只剩一把钝剑。替我清剿它们吧。',
  'data.quest.q_bandit_trouble.complete': '道路又通了。你出剑的样子，让我想起年轻时的自己。',

  // ─── Zone 2: 暮色森林 — 侦察兵 (main chain) ───
  'data.quest.q_explore_forest.offer': '你就是平原来的烙印者？村长的信到了。森林不对劲，北部密林、废弃墓地、古老遗迹，三处都去看看。看完就回。',
  'data.quest.q_explore_forest.complete': '墓地的亡灵最多，而且都朝着同一个方向跪着——东边。比我想的还糟。',
  'data.quest.q_kill_undead.offer': '骷髅和腐尸断了所有巡逻线。骷髅十二，腐尸八，送它们回土里。它们生前也是人，别让它们再受折磨。',
  'data.quest.q_kill_undead.complete': '干得利落。可死人还在往外爬。东边住着个隐士，比这林子里的树还老，也许他知道缘由。',
  'data.quest.q_talk_hermit.offer': '隐士住在森林最东边，脾气古怪，不见外人。可他说过：若有人手上带着火来，就放他进门。去吧。',
  'data.quest.q_talk_hermit.complete': '隐士肯见你，说明你手上的火是真的。坐下，喝口水，慢慢说。',
  'data.quest.q_kill_werewolf_alpha.offer': '隐士说狼王曾是月之祭司的圣狼，如今带着狼群守着黑暗之源的路。先宰六头狼人逼它现身，再……给它个痛快。',
  'data.quest.q_kill_werewolf_alpha.complete': '狼王倒下时朝着天空嚎了最后一声，不像恨，倒像道谢。路开了。',
  'data.quest.q_seal_dark_source.offer': '黑暗之源在西南角，就是被污染的月辉之印，腐尸正从那里源源不断地爬出来。杀穿尸群，把你的火按进去。',
  'data.quest.q_seal_dark_source.complete': '林子里……亮了？几百年了，我头一回看见月光落地。',
  'data.quest.q_defend_camp_forest.offer': '情报确认，亡灵今夜攻营，分三波。篝火一灭，营地就完了。守住它。',
  'data.quest.q_defend_camp_forest.complete': '三波都挡住了，篝火还亮着。这一营人的命，是你保下的。',

  // ─── Zone 2: 暮色森林 — 森林猎人 ───
  'data.quest.q_collect_wolf_pelts.offer': '嘘……林子里的狼人越来越多。它们的皮毛又厚又暖，冬天能救命。去猎几头，剥六张皮回来。',
  'data.quest.q_collect_wolf_pelts.complete': '好皮子，下刀也干净。这个冬天，营地里的人不会挨冻了。',
  'data.quest.q_lost_scout.offer': '我有个兄弟在南边的斥候营地失了联络，那边腐尸成群。帮我去找找……哪怕只带回点消息也好。',
  'data.quest.q_lost_scout.complete': '营地空了，只剩这枚徽记……谢谢你替他清了那些腐尸。他能安息了。',

  // ─── Zone 2: 暮色森林 — 通灵巫女 ───
  'data.quest.q_spider_nest.offer': '古老墓地里的骸骨……夜里爬出坟墓，亡者不得安宁。请击碎十具骷髅，让墓穴重归寂静吧。',
  'data.quest.q_spider_nest.complete': '我听见了……哭声轻了许多。那些灵魂，终于可以睡了。',
  'data.quest.q_investigate_corruption_forest.offer': '腐化不止一处……我感觉到了三股：腐烂的树根、被污染的水源，还有一座暗影祭坛。请替我去看看。',
  'data.quest.q_investigate_corruption_forest.complete': '三处的气息同出一源……都指向森林深处。这不是天灾，是有人在召唤。',
  'data.quest.q_ancient_relic.offer': '东边的古老遗迹里散落着前人的遗物。它们还记得这片森林从前的样子……请带五件回来。',
  'data.quest.q_ancient_relic.complete': '这些遗物在低语……它们说，很久以前，这里也曾被黑暗吞没过。',
  'data.quest.q_moonlight_herb.offer': '北边林间空地上，月光照着的地方生着银色的月光草药。只有它能安抚被困的亡魂……请采六株来。',
  'data.quest.q_moonlight_herb.complete': '是月光的气味……有了它，迷途的灵魂就能找到归路了。',

  // ─── Zone 3: 铁砧山脉 — 矮人长老 (main chain) ───
  'data.quest.q_explore_dwarf_ruins.offer': '哼，又一个说能救山的。不过你手上的火，先祖的碑文里提过。矿洞入口、锻造大厅、王座，去看看，回来跟我说。',
  'data.quest.q_explore_dwarf_ruins.complete': '石像鬼占了高处，巨魔占了王座——那王座底下压着的，是铁砧之印。先祖在上！',
  'data.quest.q_kill_gargoyles.offer': '那些石翼畜生是百年前那场地震惊醒的。可那不是地震，是有东西在山底下翻身。砸碎十五只，把路打通！',
  'data.quest.q_kill_gargoyles.complete': '痛快！高处清净了。现在把先祖散落的遗物找回来——我要重铸一件东西。',
  'data.quest.q_collect_dwarf_relics.offer': '布鲁恩王的秘银锭进了石魔像的肚子，符文碎片被石像鬼叼得满山都是。给我抢回来，一件都不能少！',
  'data.quest.q_collect_dwarf_relics.complete': '秘银、符文……齐了一半。孩子，你知道我要重铸的是什么吗？命运之锤。',
  'data.quest.q_reforge_artifact.offer': '命运之锤——当年锻出五道封印的就是它！只差秘银核心了，巨魔和石魔像体内会结出这东西。取三颗来！',
  'data.quest.q_reforge_artifact.complete': '锤心在跳……不，是跟着你的烙印在跳！快，站到炉前来。',
  'data.quest.q_kill_stone_guardian.offer': '戈尔姆那头蠢巨魔赖在王座上不走——王座底下的铁砧之印在对它低语。把它轰下来，用神锤和你的火重燃封印！',
  'data.quest.q_kill_stone_guardian.complete': '王座夺回来了！矮人会记你一辈子。只是南边沙海的烟柱，又高了。',
  'data.quest.q_dragon_egg.offer': '西南深山里据说有座龙巢。别怕，龙早就不在了——大概吧。去捡三片龙鳞，够打一副好甲。',
  'data.quest.q_dragon_egg.complete': '真龙鳞！这纹路我三百年来头一回见。这颗红宝石拿着，算老头子的谢礼。',
  'data.quest.q_craft_dwarf_weapon.offer': '我要重铸先祖卫队的战锤！秘银锭找石巨人，符文碎片找石像鬼，凑齐了去高级铁匠那儿锻造，再拿来给我。',
  'data.quest.q_craft_dwarf_weapon.complete': '就是这个分量！先祖卫队的战锤回到矮人手里了。这把好兵器赏你，别给我丢人。',

  // ─── Zone 3: 铁砧山脉 — 矿工老汉 ───
  'data.quest.q_crystal_mining.offer': '咳咳……东北山坡上有条水晶矿脉，亮闪闪的。老汉我腿脚不中用了，你替我敲八块下来吧。',
  'data.quest.q_crystal_mining.complete': '好水晶！拿去附魔，刀刃都能多三分锋利。咳，辛苦你了。',
  'data.quest.q_trapped_miners.offer': '塌方了！我那几个伙计还困在矿洞里，洞口全是石像鬼。求你了，先把那些鬼东西赶走！',
  'data.quest.q_trapped_miners.complete': '人都救出来了……咳咳，这份恩情，老汉我一辈子忘不了。',
  'data.quest.q_pet_jade_tortoise.offer': '老辈人讲，山里睡着一只玄武龟的魂。石魔像和石像鬼身上的灵魂碎片能唤醒它。你信不信？反正我信。',
  'data.quest.q_pet_jade_tortoise.complete': '你看，它醒了！背上还泛着玉光哩。往后它就跟着你了，好好待它。',

  // ─── Zone 3: 铁砧山脉 — 符文学者 ───
  'data.quest.q_mountain_bandits.offer': '石魔像上的守护符文失控了，见人就打，我的铭文还没抄完呢！请摧毁十座，让我能安心工作。',
  'data.quest.q_mountain_bandits.complete': '太好了，终于能安心拓印了。有意思，失控的符文似乎是从王座方向扩散的……',
  'data.quest.q_investigate_ruins_mountains.offer': '山里藏着四块符文石碑，分别在北方、东方、矿洞和山顶。请帮我找到它们，把铭文记下来。',
  'data.quest.q_investigate_ruins_mountains.complete': '四段铭文拼上了！这是一段封印咒文……矮人当年在封印什么？太迷人了。',

  // ─── Zone 4: 灼热沙漠 — 沙漠游牧民 (main chain) ───
  'data.quest.q_explore_desert.offer': '沙会说话，只是外乡人听不懂。可你手上的火，沙子认得。去烈焰荒地和蝎谷走一走，认一认这片沙海的脸。',
  'data.quest.q_explore_desert.complete': '你带回了风的消息。荒地里的火是从地底往上烧的，像一口永不熄灭的炉。',
  'data.quest.q_kill_fire_elementals.offer': '火焰元素是裂隙里漏出来的渊火碎屑，走过之处沙子都烧成了琉璃。扑灭十二团，让沙海喘口气。',
  'data.quest.q_kill_fire_elementals.complete': '火势小了。老人们说绿洲的泉水记得王国的往事，也许它能告诉你，火从哪里来。',
  'data.quest.q_explore_oasis.offer': '绿洲是沙海藏起来的一滴眼泪，曾是女王的花园。它在北边的沙丘间，去找到它，听听泉水怎么说。',
  'data.quest.q_explore_oasis.complete': '你在泉边昏睡了半日，醒来时眼里还映着火。告诉我，你看见了什么？',
  'data.quest.q_kill_sandworms.offer': '沙虫被地底的热逼上了地面，一整支驼队就这么没了。杀八条，给我们，也给你，开一条去裂隙的路。',
  'data.quest.q_kill_sandworms.complete': '沙面静下来了。只剩最南边的裂隙，和守着它的赫莉娅——女王的圣鸟。',
  'data.quest.q_seal_fire_rift.offer': '赫莉娅守着裂隙，死了也会浴火重生。别恨她，她只是被火绑住了。放她自由，让新生的火把裂隙合上。',
  'data.quest.q_seal_fire_rift.complete': '裂隙合上了，今夜的风是凉的。你手上已经亮了四团火……最后一处在哪，你心里清楚。',
  'data.quest.q_scorpion_venom.offer': '蝎谷东南的蝎子，尾针里的毒能杀人，也能救人。去猎几只，取五份蝎毒回来，我要炼药。',
  'data.quest.q_scorpion_venom.complete': '毒液纯得像月光。沙漠里的东西都这样，越致命，越珍贵。',
  'data.quest.q_escort_survivor_desert.offer': '蝎谷有个受伤的探险者，撑不过下一次日落。带他穿过蝎谷回绿洲营地，蝎子和火灵可不会客气。',
  'data.quest.q_escort_survivor_desert.complete': '他活下来了。沙海今天少吞了一个人，这是你的功劳。',
  'data.quest.q_craft_fire_ward.offer': '我要一枚挡烈日的火焰护符。带三份净化水囊、三份蝎毒去沙漠商人那儿制成护符，再拿来给我。',
  'data.quest.q_craft_fire_ward.complete': '护符凉得像井水。有它在身上，我就能走进烈焰荒地了。谢谢你，朋友。',

  // ─── Zone 4: 灼热沙漠 — 沙漠考古学家 ───
  'data.quest.q_buried_treasure.offer': '我敢打赌，东南方沙丘下就是古代神殿的入口！去把那片埋藏遗迹探一探，里面的东西能改写历史！',
  'data.quest.q_buried_treasure.complete': '这些壁画……了不起！这个文明曾经封印过什么东西，就在更深的地方。',

  // ─── Zone 4: 灼热沙漠 — 寻水者 ───
  'data.quest.q_water_supply.offer': '水就是命。西边的沙地下还埋着些旧水囊，我能感应到。去挖五个出来，营地快撑不住了。',
  'data.quest.q_water_supply.complete': '这是清水的声音……今晚营地里的孩子们，不用再舔露水了。',
  'data.quest.q_mirage_beasts.offer': '火元素在绿洲附近游荡，走到哪，泉眼就干到哪。地下的水脉在哀嚎……请驱散十五团烈焰。',
  'data.quest.q_mirage_beasts.complete': '水脉又开始跳动了。我听得见，泉水正一点点涨回来。',

  // ─── Zone 5: 深渊裂隙 — 深渊守望者 (main chain) ───
  'data.quest.q_explore_abyss.offer': '烙印者……守望者等了你一千年。裂隙入口、恶魔尖塔、混沌王座，去看清敌人的阵地。活着回来，才算数。',
  'data.quest.q_explore_abyss.complete': '你回来了，很少有人做到。你的脸色告诉我，你已经见过那扇门了。',
  'data.quest.q_kill_demons.offer': '门缝每宽一寸，就多涌出一群恶魔。小恶魔二十，次级恶魔十。数字不重要，别让一只越过裂隙。',
  'data.quest.q_kill_demons.complete': '它们退了一步，只是一步。要锻终焉之钥，得用它们自己的精华作引。',
  'data.quest.q_collect_demon_essence.offer': '以渊火之物锁渊火之门，这是艾瑟琳留下的法子。小恶魔、次级恶魔、魅魔身上都有精华，十五份。去收。',
  'data.quest.q_collect_demon_essence.complete': '精华够了。最后一步，把守护者们用命换来的封印碎片锻成钥匙。',
  'data.quest.q_forge_seal.offer': '碎片散在英雄纪念碑附近，每一片都是我同袍的命。捡回五片，用你带来的命运之锤，锻出终焉之钥。',
  'data.quest.q_forge_seal.complete': '钥匙成了。可它还缺一样东西……你心里已经明白了，对吗？',
  'data.quest.q_kill_abyss_lord.offer': '他就在混沌王座上，等着你，也等着你的火。拿上钥匙去吧。守望者等了一千年，别让我们白等。',
  'data.quest.q_kill_abyss_lord.complete': '门合上了。渊火没有熄，它回到了炉膛里。回家吧，守火人。',
  'data.quest.q_demon_weaponry.offer': '恶魔的兵器浸过深渊之火，在它们手里是屠刀，在我们手里是利刃。杀次级恶魔和魅魔，夺过来。',
  'data.quest.q_demon_weaponry.complete': '好刃。深渊锻出的东西，终究也能斩向深渊。',
  'data.quest.q_defend_seal_abyss.offer': '恶魔军团在冲击封印石，五波。封印石一碎，深渊就会再次扩张。守住，不许退。',
  'data.quest.q_defend_seal_abyss.complete': '封印石还立着。你也还站着。够了。',

  // ─── Zone 5: 深渊裂隙 — 堕落骑士 ───
  'data.quest.q_corrupted_souls.offer': '那些小恶魔……在裂隙里四处游荡，每一只都在啃食这片土地。清掉十五只吧，趁我还分得清敌我。',
  'data.quest.q_corrupted_souls.complete': '低语……轻了一些。谢谢你。至少今晚，我还能想起自己的名字。',
  'data.quest.q_fallen_hero.offer': '陨落神殿和英雄纪念碑……我的同袍都葬在那里。替我去看看他们留下了什么。我……没脸去。',
  'data.quest.q_fallen_hero.complete': '他们没有白死……你带回的遗志，我听见了。也许，我还配握剑。',

  // ─── Zone 5: 深渊裂隙 — 虚空研究者 ───
  'data.quest.q_void_crystals.offer': '恶魔体内会凝出虚空水晶，多迷人的东西！帮我收十块，拿来加固封印——顺便做点研究。',
  'data.quest.q_void_crystals.complete': '看这折射，空间在里面扭曲！够加固一段封印了。剩下的……归我研究。',
};

export const QUEST_STORY_EN: LocaleData = {
  // ─── Zone 1: Emerald Plains — Village Elder (main chain) ───
  'data.quest.q_kill_slimes.offer': 'Three days you slept in those ashes, and now you\'re awake. Since the fire pillar, the slimes up in the northern wetlands have run wild. Clear ten for an old man, and mind their acid.',
  'data.quest.q_kill_slimes.complete': 'The fields are quiet, thank you. Wait... give me your hand. That brand on your palm. I\'ve seen it on the elven stele.',
  'data.quest.q_kill_goblins.offer': 'Goblins crept into the village again last night. Strange thing: their eyes burn with the same fire as your brand. Go south, teach them a lesson, and learn where that fire comes from.',
  'data.quest.q_kill_goblins.complete': 'They fell back, but the fire in their eyes hasn\'t gone out. The hunters say there\'s a camp deep in the south where a shaman dances over the fire every night.',
  'data.quest.q_explore_goblin_camp.offer': 'Their camp lies deep in the southern plains. The bonfires haven\'t died in seven days, and the shaman chants at the ground. Scout it out, see what they\'re waking. No heroics.',
  'data.quest.q_explore_goblin_camp.complete': 'Ley-line patterns carved on the totems... they mean to pry open the seal under the plains! And the chief is the crowbar.',
  'data.quest.q_find_goblin_chief.offer': 'The chief is called Grokk, hiding deep in the southwest. He\'s promised his tribe the fire\'s blessing for the "branded hand". Child, he wants you. Come back alive.',
  'data.quest.q_find_goblin_chief.complete': 'Grokk is dead and the tribe has scattered! But my heart\'s still in my throat. The ley lines are trembling underground.',
  'data.quest.q_secure_plains.offer': 'The ley lines are still shaking. I can feel it through my boots. Walk the east and the south. The stele says the veins grow calm wherever the brand-bearer treads.',
  'data.quest.q_secure_plains.complete': 'The trembling underground has stopped. The first seal holds... Child, the fire in your hand looks a little brighter.',
  // ─── Zone 1: Emerald Plains — side quests ───
  'data.quest.q_collect_slime_gel.offer': 'The merchant asked me to find a helper; his potions need slime gel. Watch for gel when slimes fall. Eight portions will do.',
  'data.quest.q_collect_slime_gel.complete': 'That\'s enough gel for several batches. Take a few potions for the road, and no arguing.',
  'data.quest.q_herb_gathering.offer': 'The herbalist\'s hut is full of wounded and her herbs ran out days ago. Emerald herbs glow faintly in the western meadows. Bring back five.',
  'data.quest.q_herb_gathering.complete': 'With these, the wounded will pull through. You have a good heart.',
  'data.quest.q_lost_pendant.offer': 'Goblins stole old Wang\'s heirloom pendant, and his wife wept all night. Go after the goblins to the east. One of them must have it.',
  'data.quest.q_lost_pendant.complete': 'That\'s the one! She\'ll be overjoyed. Please, take this small token.',
  'data.quest.q_rare_mushroom.offer': 'Glowing mana mushrooms grow in the northeastern wetlands, and the herbalist pays well for them. Six would see the village through winter.',
  'data.quest.q_rare_mushroom.complete': 'Plump and perfect! The herbalist will be delighted. You\'ve earned this.',
  'data.quest.q_escort_merchant_plains.offer': 'A merchant must reach the southern camp, but the road crawls with goblins. Our supplies depend on him. Go with him and keep him safe.',
  'data.quest.q_escort_merchant_plains.complete': 'The merchant arrived safely and sent his thanks. It was a hard road.',
  'data.quest.q_pet_sprite_friend.offer': 'A little sprite lives on the plains and hates how slimes trample its flowers. They say it will follow whoever drives off twenty of them.',
  'data.quest.q_pet_sprite_friend.complete': 'Look at it circling your shoulder. It\'s chosen you as a friend. Be good to it.',

  // ─── Zone 1: Emerald Plains — Wandering Swordsman ───
  'data.quest.q_bandit_trouble.offer': 'Goblins lie in ambush on the southern road, preying on caravans. I once swore to guard roads like that... now I have only a dull blade. Clear them out for me.',
  'data.quest.q_bandit_trouble.complete': 'The road is open again. The way you swing a sword reminds me of myself, long ago.',

  // ─── Zone 2: Twilight Forest — Scout (main chain) ───
  'data.quest.q_explore_forest.offer': 'So you\'re the brand-bearer from the plains? The elder\'s letter came. The forest is wrong. Northern woods, old graveyard, ancient ruins: look at all three, then come back.',
  'data.quest.q_explore_forest.complete': 'The graveyard is the worst, and the dead there all kneel facing the same way: east. Worse than I thought.',
  'data.quest.q_kill_undead.offer': 'Skeletons and ghouls have cut every patrol route. Twelve skeletons, eight ghouls. Put them back in the ground. They were people once. Don\'t let them suffer more.',
  'data.quest.q_kill_undead.complete': 'Clean work. But the dead keep crawling out. A hermit lives in the east, older than the trees. He may know why.',
  'data.quest.q_talk_hermit.offer': 'The hermit lives at the far east of the forest. Odd man, shuns strangers. But he once said: if someone comes with fire in their hand, let them in. Go.',
  'data.quest.q_talk_hermit.complete': 'If the hermit let you in, the fire in your hand is real. Sit, have some water, and tell it slowly.',
  'data.quest.q_kill_werewolf_alpha.offer': 'The hermit says the wolf king was the Moon Priestess\'s sacred wolf. Now it guards the road to the dark source. Kill six werewolves to draw it out, then... make it quick.',
  'data.quest.q_kill_werewolf_alpha.complete': 'When the wolf king fell, it howled once more at the sky. Not in hate. More like thanks. The road is open.',
  'data.quest.q_seal_dark_source.offer': 'The dark source is in the southwest corner: the fouled Moon Seal. Ghouls pour out of it without end. Cut through them and press your fire into it.',
  'data.quest.q_seal_dark_source.complete': 'The forest is... bright? Centuries, and this is the first moonlight I\'ve seen touch the ground.',
  'data.quest.q_defend_camp_forest.offer': 'Confirmed: the dead hit the camp tonight, three waves. If the campfire dies, the camp dies. Hold it.',
  'data.quest.q_defend_camp_forest.complete': 'Three waves held, fire still burning. Every soul in this camp owes you.',

  // ─── Zone 2: Twilight Forest — Forest Hunter ───
  'data.quest.q_collect_wolf_pelts.offer': 'Shh... more werewolves every night. Their hides are thick and warm, and winter kills. Hunt a few and bring me six pelts.',
  'data.quest.q_collect_wolf_pelts.complete': 'Good hides, clean cuts. Nobody in camp will freeze this winter.',
  'data.quest.q_lost_scout.offer': 'A brother of mine went silent at the scout camp to the south, and ghouls swarm there. Find him... or at least bring back word.',
  'data.quest.q_lost_scout.complete': 'The camp\'s empty but for this badge... Thank you for clearing those ghouls. He can rest now.',

  // ─── Zone 2: Twilight Forest — Spirit Medium ───
  'data.quest.q_spider_nest.offer': 'The bones in the old graveyard... they crawl from their graves at night, and the dead find no rest. Shatter ten skeletons and let the crypt be still.',
  'data.quest.q_spider_nest.complete': 'I hear it... the weeping has softened. Those souls can finally sleep.',
  'data.quest.q_investigate_corruption_forest.offer': 'The corruption is not one thing... I sense three: rotting roots, a fouled spring, and a shadow altar. Please, go and see them for me.',
  'data.quest.q_investigate_corruption_forest.complete': 'All three share one source... deep in the forest. This is no blight. Someone is summoning it.',
  'data.quest.q_ancient_relic.offer': 'Relics of an older people lie scattered in the ancient ruins to the east. They remember what this forest once was... bring me five.',
  'data.quest.q_ancient_relic.complete': 'These relics whisper... they say darkness swallowed this place once before, long ago.',
  'data.quest.q_moonlight_herb.offer': 'In the northern glades, silver moonlight herbs grow where the moon touches the ground. Only they can soothe the trapped spirits... gather six.',
  'data.quest.q_moonlight_herb.complete': 'The scent of moonlight... with this, the lost souls can find their way home.',

  // ─── Zone 3: Anvil Mountains — Dwarven Elder (main chain) ───
  'data.quest.q_explore_dwarf_ruins.offer': 'Hmph. Another one who says they\'ll save the mountain. Still, the fire in your hand is in our ancestors\' inscriptions. Mine entrance, forge hall, throne. Go look, then report.',
  'data.quest.q_explore_dwarf_ruins.complete': 'Gargoyles on the heights, a troll on the throne, and beneath that throne lies the Anvil Seal. By my ancestors!',
  'data.quest.q_kill_gargoyles.offer': 'Those stone-winged vermin woke in the quake a hundred years ago. Only it was no quake: something turned over beneath the mountain. Smash fifteen and clear the road!',
  'data.quest.q_kill_gargoyles.complete': 'Ha! The heights are clear. Now bring back our ancestors\' scattered relics. There\'s something I mean to reforge.',
  'data.quest.q_collect_dwarf_relics.offer': 'King Bruun\'s mithril ingots went down the golems\' gullets, and the gargoyles carried his rune fragments all over the mountain. Take them back. Every last one!',
  'data.quest.q_collect_dwarf_relics.complete': 'Mithril, runes... half of what we need. Child, do you know what I mean to reforge? The Hammer of Fate.',
  'data.quest.q_reforge_artifact.offer': 'The Hammer of Fate: the very hammer that forged the five seals! All it lacks is mithril cores. They grow inside trolls and golems. Bring me three!',
  'data.quest.q_reforge_artifact.complete': 'The hammer\'s heart is beating... no, it\'s beating in time with your brand! Quick, stand at the forge.',
  'data.quest.q_kill_stone_guardian.offer': 'That dim-witted troll Gorm won\'t budge from our throne. The Anvil Seal beneath it is whispering to him. Knock him off and rekindle the seal with the Hammer and your fire!',
  'data.quest.q_kill_stone_guardian.complete': 'The throne is ours again! No dwarf will ever forget you. But the smoke over the southern desert has grown taller.',
  'data.quest.q_dragon_egg.offer': 'They say there\'s a dragon\'s nest deep in the southwest. Don\'t worry, the dragon\'s long gone. Probably. Three scales would make fine armor.',
  'data.quest.q_dragon_egg.complete': 'True dragon scales! First I\'ve seen in three hundred years. Take this ruby, an old dwarf\'s thanks.',
  'data.quest.q_craft_dwarf_weapon.offer': 'I will reforge the warhammer of my ancestors\' guard! Ingots from golems, rune fragments from gargoyles. Take them to the master smith, then bring it to me.',
  'data.quest.q_craft_dwarf_weapon.complete': 'That\'s the weight! The old guard\'s hammer is back in dwarven hands. Take this fine weapon, and don\'t shame it.',

  // ─── Zone 3: Anvil Mountains — Old Miner ───
  'data.quest.q_crystal_mining.offer': '*cough* There\'s a crystal vein on the northeastern slope, sparkling away. My old legs can\'t manage it. Chip off eight for me, would you?',
  'data.quest.q_crystal_mining.complete': 'Fine crystals! Enchant a blade with these and it\'ll bite deeper. Thank you kindly.',
  'data.quest.q_trapped_miners.offer': 'Cave-in! My mates are trapped in the mine and gargoyles swarm the entrance. Please, drive those devils off!',
  'data.quest.q_trapped_miners.complete': 'Everyone\'s out... *cough* I\'ll not forget this as long as I live.',
  'data.quest.q_pet_jade_tortoise.offer': 'The old folk say a tortoise spirit sleeps in these mountains. Soul shards from golems and gargoyles can wake it. Believe it or not, I do.',
  'data.quest.q_pet_jade_tortoise.complete': 'Look, it\'s awake! Its shell glows like jade. It\'s yours now, so treat it well.',

  // ─── Zone 3: Anvil Mountains — Rune Scholar ───
  'data.quest.q_mountain_bandits.offer': 'The guardian runes on the golems have gone wild, and they attack anyone. I haven\'t finished copying the inscriptions! Destroy ten so I can work.',
  'data.quest.q_mountain_bandits.complete': 'Wonderful, I can take rubbings in peace. Curious... the runes seem to have spread from the throne.',
  'data.quest.q_investigate_ruins_mountains.offer': 'Four rune steles are hidden in these mountains: north, east, in the mine, and on the summit. Find them and record the inscriptions.',
  'data.quest.q_investigate_ruins_mountains.complete': 'The four pieces fit! It\'s a sealing incantation... what were the dwarves sealing? Fascinating.',

  // ─── Zone 4: Scorching Desert — Desert Nomad (main chain) ───
  'data.quest.q_explore_desert.offer': 'The sand speaks, but strangers cannot hear it. The fire in your hand, though, the sand knows. Walk the Fire Wastes and Scorpion Valley. Learn the face of this desert.',
  'data.quest.q_explore_desert.complete': 'You bring word from the wind. The fire in the wastes burns upward from below, like a furnace that never goes out.',
  'data.quest.q_kill_fire_elementals.offer': 'The fire elementals are shards of Abyssfire leaking from the rift. Sand turns to glass where they walk. Snuff out twelve and let the desert breathe.',
  'data.quest.q_kill_fire_elementals.complete': 'The flames are weaker. The elders say the oasis spring remembers the kingdom. Perhaps it can tell you where the fire comes from.',
  'data.quest.q_explore_oasis.offer': 'The oasis is a tear the desert keeps hidden. Once it was the queen\'s garden. It lies among the northern dunes. Find it, and listen to what the spring says.',
  'data.quest.q_explore_oasis.complete': 'You slept half a day by the spring, and woke with fire still in your eyes. Tell me what you saw.',
  'data.quest.q_kill_sandworms.offer': 'The heat below drove the sandworms to the surface, and a whole caravan vanished. Kill eight and open a road to the rift, for us and for you.',
  'data.quest.q_kill_sandworms.complete': 'The sand lies still. Only the rift in the far south remains, and Helia who guards it: the queen\'s sacred bird.',
  'data.quest.q_seal_fire_rift.offer': 'Helia guards the rift and rises again from her own ashes. Don\'t hate her; the fire has bound her. Set her free, and let her new flame close the rift.',
  'data.quest.q_seal_fire_rift.complete': 'The rift is closed, and tonight the wind is cool. Four fires burn in your hand now... you know where the last one is.',
  'data.quest.q_scorpion_venom.offer': 'The scorpions southeast of the valley carry venom that kills, and also heals. Hunt a few and bring me five vials. I will brew medicine.',
  'data.quest.q_scorpion_venom.complete': 'Venom as pure as moonlight. So it is in the desert: the deadlier, the more precious.',
  'data.quest.q_escort_survivor_desert.offer': 'A wounded explorer lies in Scorpion Valley; he won\'t last another sunset. Lead him through to the oasis camp. The scorpions and flames will show no mercy.',
  'data.quest.q_escort_survivor_desert.complete': 'He lives. The desert swallowed one fewer today, thanks to you.',
  'data.quest.q_craft_fire_ward.offer': 'I need a fire ward against the sun. Take three purified waterskins and three venoms to the desert merchant, have it made, and bring it to me.',
  'data.quest.q_craft_fire_ward.complete': 'The ward is cool as well water. With it, I can walk into the Fire Wastes. Thank you, friend.',

  // ─── Zone 4: Scorching Desert — Desert Archaeologist ───
  'data.quest.q_buried_treasure.offer': 'I\'d stake my career on it: an ancient temple entrance lies under the dunes to the southeast! Explore those buried ruins. What\'s inside could rewrite history!',
  'data.quest.q_buried_treasure.complete': 'These murals... remarkable! This civilization once sealed something away, somewhere deeper still.',

  // ─── Zone 4: Scorching Desert — Water Diviner ───
  'data.quest.q_water_supply.offer': 'Water is life. Old waterskins lie buried in the western sands; I can feel them. Dig up five. The camp can\'t hold out much longer.',
  'data.quest.q_water_supply.complete': 'That is the sound of clean water... tonight the children won\'t have to lick the dew.',
  'data.quest.q_mirage_beasts.offer': 'Fire elementals wander near the oasis, and every spring they pass runs dry. The water veins below are crying out... disperse fifteen of those flames.',
  'data.quest.q_mirage_beasts.complete': 'The veins have a pulse again. I can hear the springs slowly rising.',

  // ─── Zone 5: Abyss Rift — Abyss Warden (main chain) ───
  'data.quest.q_explore_abyss.offer': 'Brand-bearer... the wardens have waited a thousand years for you. The rift entrance, the Demon Spire, the Throne of Chaos: go learn the enemy\'s ground. It counts only if you return.',
  'data.quest.q_explore_abyss.complete': 'You came back. Few do. Your face tells me you\'ve already seen the gate.',
  'data.quest.q_kill_demons.offer': 'Every inch the gate widens, another horde pours through. Twenty imps, ten lesser demons. The numbers don\'t matter. Let none of them cross the rift.',
  'data.quest.q_kill_demons.complete': 'They fell back a step. Only a step. To forge the Final Key, we need their own essence as the binding.',
  'data.quest.q_collect_demon_essence.offer': 'Lock the fire\'s gate with things of the fire: that was Aethelyn\'s way. Imps, lesser demons, succubi all carry essence. Fifteen. Go.',
  'data.quest.q_collect_demon_essence.complete': 'Enough essence. Last of all, the seal fragments the wardens paid for with their lives must be forged into a key.',
  'data.quest.q_forge_seal.offer': 'The fragments lie near the Heroes\' Memorial, and each one cost a comrade\'s life. Bring back five, and forge the Final Key with the Hammer you carry.',
  'data.quest.q_forge_seal.complete': 'The key is made. But it still lacks one thing... you already know, don\'t you?',
  'data.quest.q_kill_abyss_lord.offer': 'He sits on the Throne of Chaos, waiting for you, and for your fire. Take the key and go. The wardens have waited a thousand years. Don\'t let it be for nothing.',
  'data.quest.q_kill_abyss_lord.complete': 'The gate is closed. The Abyssfire isn\'t out; it has gone back to the hearth. Go home, Flamekeeper.',
  'data.quest.q_demon_weaponry.offer': 'Demon weapons are quenched in abyssal fire: butchers\' tools in their hands, fine blades in ours. Kill lesser demons and succubi and take them.',
  'data.quest.q_demon_weaponry.complete': 'Good steel. What the abyss forges can cut the abyss in turn.',
  'data.quest.q_defend_seal_abyss.offer': 'The demon legion is assaulting the seal stone. Five waves. If it breaks, the abyss spreads again. Hold. Do not fall back.',
  'data.quest.q_defend_seal_abyss.complete': 'The seal stone stands. So do you. That\'s enough.',

  // ─── Zone 5: Abyss Rift — Fallen Knight ───
  'data.quest.q_corrupted_souls.offer': 'Those imps... they roam the rift, and each one gnaws at this land. Kill fifteen, while I can still tell friend from foe.',
  'data.quest.q_corrupted_souls.complete': 'The whispers... are fainter. Thank you. Tonight, at least, I can remember my own name.',
  'data.quest.q_fallen_hero.offer': 'The Fallen Shrine and the Heroes\' Memorial... my brothers-in-arms lie there. See what they left behind. I... cannot face them.',
  'data.quest.q_fallen_hero.complete': 'They did not die in vain... I hear their last will in what you bring. Perhaps I\'m still fit to hold a sword.',

  // ─── Zone 5: Abyss Rift — Void Researcher ───
  'data.quest.q_void_crystals.offer': 'Void crystals form inside demons. Fascinating things! Collect ten for me to reinforce the seal, and, well, for a little research.',
  'data.quest.q_void_crystals.complete': 'Look at that refraction; space bends inside it! Enough to reinforce the seal. The rest... is for science.',
};
