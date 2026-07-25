// Core/I18n.js
// All player-facing strings live here (not in Core/Config.js, which stays
// pure balance data) so the game can switch between 中文 and English at
// runtime. UI/HUD.js calls t('some.key') and re-renders when the language
// changes; nothing else in the codebase should hardcode display text.

import { eventBus } from './EventBus.js';

export const DICTIONARY = {

	zh: {
		gameTitleZh: '病毒清理者', gameTitleEn: 'MED-X',
		subtitle: '三维 Roguelike 动作射击 · 人体战场',
		controlsHint: 'WASD 移动 · 鼠标瞄准 · 左键射击 · 空格闪避 · Shift 冲刺<br/>Q 副武器 · E 主动技能 · F 终极技能 · C 互动 · Esc 暂停',

		btnStart: '开始游戏', btnContinue: '继续游戏', btnSaveData: '存档', btnSettings: '设置', btnExit: '退出游戏',
		btnBack: '返回', btnResume: '继续', btnMainMenu: '返回主菜单', btnSave: '保存', btnRestart: '重新开始',
		btnDeleteSave: '删除存档', btnConfirm: '确认', btnCancel: '取消',

		heroSelectTitle: '选择你的纳米机型',
		kitActive: '主动', kitPassive: '被动', kitUltimate: '终极',

		settingsTitle: '设置', musicVolume: '音乐音量', sfxVolume: '音效音量', language: '语言',

		pauseTitle: '已暂停',
		saveDataTitle: '存档信息', noSaveData: '暂无存档记录',
		savedAtLabel: '保存时间', savedActLabel: '所在幕', savedRoomLabel: '所在房间', savedHeroLabel: '当前机型', savedKillsLabel: '累计击杀',
		confirmDeleteSave: '确定要删除该存档吗？此操作无法撤销。',

		exitMessage: '感谢游玩《病毒清理者》。你现在可以关闭此浏览器标签页了。',

		gameOverTitle: '行动失败', gameOverDesc: '抵达第 {act} 幕 · 击杀 {kills} 个感染体',
		victoryTitle: '治愈成功', victoryDesc: '感染源已清除 · 击杀 {kills} 个感染体',

		upgradeChoiceTitle: '选择强化',
		rarityCommon: '普通', rarityRare: '稀有',

		runProgress: '第 {act} 幕 · {biome} — 房间 {room}/{total} [{type}]',
		organHealthLabel: '器官健康',
		roomContinuePrompt: '继续前进 (C)',

		roomType_combat: '战斗', roomType_elite: '精英', roomType_supply: '补给', roomType_event: '事件',
		roomType_shop: '商店', roomType_hidden: '隐藏', roomType_boss: 'BOSS',

		roomReward_supply_title: '补给站', roomReward_supply_desc: '按 C 键补充 ATP 与生命值，准备好后继续前进。',
		roomReward_shop_title: '交易细胞', roomReward_shop_desc: '本次巡逻没有可用货币系统占位 — 直接获得一次额外强化机会。',
		roomReward_event_title: '突发事件', roomReward_event_desc: '一场小规模遭遇战正在发生。',

		bossPhase_phase1: '第一阶段', bossPhase_phase2: '第二阶段', bossPhase_enrage: '狂暴阶段',

		heroes: {
			assault: { name: '抗生素突击型', role: '突击型', desc: '冲锋枪 + 手雷，高爆发中距离压制' },
			sniper: { name: '抗病毒狙击型', role: '狙击型', desc: '高精度远程点射，弱点打击、低误伤' },
			guardian: { name: '免疫强化守护型', role: '守护型', desc: '手术刀近战 + 护盾，强化白细胞、控场' },
		},
		skills: {
			smg: { name: '广谱冲锋枪' }, railgun: { name: '抗病毒狙击枪' }, scalpel: { name: '强化手术刀' },
			grenade: { name: '溶解手雷' }, markerDart: { name: '标记飞镖' }, aegisField: { name: '守护立场', desc: '展开护盾力场，减免范围内伤害并强化白细胞' },
			chargeDash: { name: '冲锋突进', desc: '向前急冲，撞击路径上的敌人造成伤害并短暂加速' },
			focusZoom: { name: '聚焦瞄准', desc: '进入聚焦状态：暴击率提升，但移速降低' },
			immunePulse: { name: '免疫脉冲', desc: '向外释放脉冲，眩晕周围敌人并治疗附近白细胞/血小板' },
			adrenaline: { name: '肾上腺素', desc: '生命值低于30%时移速与射速提升20%' },
			weakpointReader: { name: '弱点分析', desc: '对被标记或精英/Boss目标造成的伤害提升15%' },
			phagocyteBond: { name: '吞噬纽带', desc: '附近的白细胞与巨噬细胞攻击力提升20%，且会优先保护你' },
			sporeBarrage: { name: '广谱轰炸', desc: '在周围区域召唤持续弹幕轰炸' },
			orbitalLance: { name: '轨道穿刺', desc: '召唤一记贯穿全场的高能穿刺打击' },
			fortressProtocol: { name: '堡垒协议', desc: '化身堡垒：大幅减伤、嘲讽全场敌人并反弹部分伤害' },
		},
		upgrades: {
			ricochet: { name: '弹射弹道', desc: '子弹命中后有几率弹射到附近敌人' },
			critUp: { name: '精准打击', desc: '暴击率 +12%' },
			wbcDamage: { name: '免疫增效', desc: '附近白细胞伤害 +30%' },
			atpRegenUp: { name: '代谢加速', desc: 'ATP 回复速度 +25%' },
			cooldownDown: { name: '酶促反应', desc: '技能冷却 -15%' },
			elemFreeze: { name: '低温附加', desc: '攻击附加冰冻效果，减速命中的敌人' },
			elemBurn: { name: '灼烧附加', desc: '攻击附加持续灼烧伤害' },
			elemShock: { name: '电击附加', desc: '攻击附加连锁电击，可跳跃到附近敌人' },
			elemCorrode: { name: '腐蚀附加', desc: '攻击附加腐蚀效果，降低敌人护甲' },
			maxHpUp: { name: '细胞增殖', desc: '最大生命值 +20' },
			maxShieldUp: { name: '膜蛋白强化', desc: '最大护盾 +18' },
			lifesteal: { name: '再生因子', desc: '造成伤害时回复少量生命' },
			pierceUp: { name: '穿透弹头', desc: '子弹穿透次数 +1' },
			moveSpeedUp: { name: '流体动力', desc: '移动速度 +10%' },
			ultimateChargeUp: { name: '能量共振', desc: '终极技能获取能量速度 +30%' },
		},
		biomes: { bloodVessel: '血管', lung: '肺部', liver: '肝脏' },
		bosses: { necroCore: '坏死核心' },
	},

	en: {
		gameTitleZh: '病毒清理者', gameTitleEn: 'MED-X',
		subtitle: '3D Roguelike Action Shooter · Battlefield Inside the Human Body',
		controlsHint: 'WASD Move · Mouse Aim · LMB Fire · Space Dodge · Shift Sprint<br/>Q Secondary · E Active Skill · F Ultimate · C Interact · Esc Pause',

		btnStart: 'New Game', btnContinue: 'Continue', btnSaveData: 'Save Data', btnSettings: 'Settings', btnExit: 'Exit Game',
		btnBack: 'Back', btnResume: 'Resume', btnMainMenu: 'Main Menu', btnSave: 'Save', btnRestart: 'Restart',
		btnDeleteSave: 'Delete Save', btnConfirm: 'Confirm', btnCancel: 'Cancel',

		heroSelectTitle: 'Choose Your Nanobot',
		kitActive: 'Active', kitPassive: 'Passive', kitUltimate: 'Ultimate',

		settingsTitle: 'Settings', musicVolume: 'Music Volume', sfxVolume: 'SFX Volume', language: 'Language',

		pauseTitle: 'Paused',
		saveDataTitle: 'Save Data', noSaveData: 'No save data found',
		savedAtLabel: 'Saved at', savedActLabel: 'Act', savedRoomLabel: 'Room', savedHeroLabel: 'Hero', savedKillsLabel: 'Kills',
		confirmDeleteSave: 'Delete this save? This cannot be undone.',

		exitMessage: 'Thanks for playing MED-X. You can close this browser tab now.',

		gameOverTitle: 'Mission Failed', gameOverDesc: 'Reached Act {act} · {kills} infections eliminated',
		victoryTitle: 'Patient Cured', victoryDesc: 'Infection source eliminated · {kills} infections eliminated',

		upgradeChoiceTitle: 'Choose an Upgrade',
		rarityCommon: 'Common', rarityRare: 'Rare',

		runProgress: 'Act {act} · {biome} — Room {room}/{total} [{type}]',
		organHealthLabel: 'Organ Health',
		roomContinuePrompt: 'Continue (C)',

		roomType_combat: 'Combat', roomType_elite: 'Elite', roomType_supply: 'Supply', roomType_event: 'Event',
		roomType_shop: 'Shop', roomType_hidden: 'Hidden', roomType_boss: 'BOSS',

		roomReward_supply_title: 'Supply Station', roomReward_supply_desc: 'Press C to restore ATP and health, then move on when ready.',
		roomReward_shop_title: 'Cell Exchange', roomReward_shop_desc: 'No currency system yet for this patrol — take a bonus upgrade instead.',
		roomReward_event_title: 'Sudden Event', roomReward_event_desc: 'A small skirmish is breaking out.',

		bossPhase_phase1: 'Phase One', bossPhase_phase2: 'Phase Two', bossPhase_enrage: 'Enrage Phase',

		heroes: {
			assault: { name: 'Antibiotic Assault', role: 'Assault', desc: 'SMG + grenades — high burst, mid-range suppression' },
			sniper: { name: 'Antiviral Sniper', role: 'Sniper', desc: 'High-precision long range, weak-point strikes, low collateral' },
			guardian: { name: 'Immune Guardian', role: 'Guardian', desc: 'Scalpel melee + shields — buffs white blood cells, controls the fight' },
		},
		skills: {
			smg: { name: 'Broad-Spectrum SMG' }, railgun: { name: 'Antiviral Railgun' }, scalpel: { name: 'Enhanced Scalpel' },
			grenade: { name: 'Lysis Grenade' }, markerDart: { name: 'Marker Dart' }, aegisField: { name: 'Aegis Field', desc: 'Deploys a shield field that reduces damage and buffs nearby white blood cells' },
			chargeDash: { name: 'Charge Dash', desc: 'Dash forward, damaging enemies in your path and briefly speeding up' },
			focusZoom: { name: 'Focus Aim', desc: 'Enter focus: increased crit chance but reduced move speed' },
			immunePulse: { name: 'Immune Pulse', desc: 'Emit a pulse that stuns nearby enemies and heals nearby white blood cells/platelets' },
			adrenaline: { name: 'Adrenaline', desc: 'Below 30% health, move speed and fire rate increase by 20%' },
			weakpointReader: { name: 'Weakpoint Analysis', desc: '+15% damage to marked, elite, or boss targets' },
			phagocyteBond: { name: 'Phagocyte Bond', desc: 'Nearby white blood cells and macrophages deal 20% more damage and prioritize protecting you' },
			sporeBarrage: { name: 'Broad-Spectrum Barrage', desc: 'Summons sustained barrage fire in the surrounding area' },
			orbitalLance: { name: 'Orbital Lance', desc: 'Calls down a field-piercing high-energy lance strike' },
			fortressProtocol: { name: 'Fortress Protocol', desc: 'Become a fortress: major damage reduction, taunts the whole field, and reflects some damage' },
		},
		upgrades: {
			ricochet: { name: 'Ricochet Rounds', desc: 'Bullets have a chance to ricochet to nearby enemies on hit' },
			critUp: { name: 'Precision Strike', desc: '+12% crit chance' },
			wbcDamage: { name: 'Immune Boost', desc: 'Nearby white blood cell damage +30%' },
			atpRegenUp: { name: 'Metabolic Boost', desc: 'ATP regen speed +25%' },
			cooldownDown: { name: 'Enzymatic Reaction', desc: 'Skill cooldowns -15%' },
			elemFreeze: { name: 'Cryo Payload', desc: 'Attacks apply a freeze effect that slows hit enemies' },
			elemBurn: { name: 'Burn Payload', desc: 'Attacks apply ongoing burn damage' },
			elemShock: { name: 'Shock Payload', desc: 'Attacks apply chain lightning that jumps to nearby enemies' },
			elemCorrode: { name: 'Corrosive Payload', desc: 'Attacks apply corrosion, lowering enemy resistance' },
			maxHpUp: { name: 'Cell Proliferation', desc: 'Max health +20' },
			maxShieldUp: { name: 'Membrane Reinforcement', desc: 'Max shield +18' },
			lifesteal: { name: 'Regenerative Factor', desc: 'Heal a small amount when dealing damage' },
			pierceUp: { name: 'Piercing Rounds', desc: 'Bullet pierce count +1' },
			moveSpeedUp: { name: 'Fluid Dynamics', desc: 'Move speed +10%' },
			ultimateChargeUp: { name: 'Energy Resonance', desc: 'Ultimate charge rate +30%' },
		},
		biomes: { bloodVessel: 'Blood Vessel', lung: 'Lung', liver: 'Liver' },
		bosses: { necroCore: 'Necrotic Core' },
	},
};

let _lang = 'zh';

export function getLanguage() { return _lang; }

export function setLanguage( lang ) {
	if ( lang !== 'zh' && lang !== 'en' ) return;
	if ( _lang === lang ) return;
	_lang = lang;
	eventBus.emit( 'i18n:change', lang );
}

// Looks up a dot-separated path (e.g. 'heroes.assault.name') in the
// current language, falling back to zh, then to the key itself so a
// missing translation never crashes the UI. `vars` interpolates {name}
// placeholders.
export function t( path, vars ) {
	const dict = DICTIONARY[ _lang ] || DICTIONARY.zh;
	let value = _lookup( dict, path );
	if ( value === undefined ) value = _lookup( DICTIONARY.zh, path );
	if ( value === undefined ) return path;
	if ( typeof value === 'string' && vars ) {
		for ( const k in vars ) value = value.replace( new RegExp( `\\{${k}\\}`, 'g' ), vars[ k ] );
	}
	return value;
}

function _lookup( obj, path ) {
	return path.split( '.' ).reduce( ( acc, key ) => ( acc && acc[ key ] !== undefined ? acc[ key ] : undefined ), obj );
}
