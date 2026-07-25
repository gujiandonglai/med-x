// Core/Config.js
// Data-driven definitions for the whole game. Nothing here is executable
// gameplay logic — it's numbers/strings that Gameplay/* reads. Designers
// (or future-you) balance the game by editing this file, not code.

export const HEROES = {

	assault: {
		id: 'assault', name: '抗生素突击型', role: 'Assault',
		desc: '冲锋枪 + 手雷，高爆发中距离压制',
		color: 0x4fd6ff, accentColor: 0xff5d5d,
		maxHealth: 120, maxShield: 40, maxATP: 100, atpRegen: 9,
		moveSpeed: 7.2, sprintMult: 1.4, dodgeDistance: 5.5, dodgeCost: 15,
		primary: { id: 'smg', name: '广谱冲锋枪', damage: 8, fireRate: 9, atpCost: 1.6, projSpeed: 46, spread: 0.055, pierce: 0, color: 0x7fe3ff },
		secondary: { id: 'grenade', name: '溶解手雷', damage: 60, atpCost: 26, cooldown: 4.5, radius: 5.2, projSpeed: 22, color: 0xff8a3d },
		active: { id: 'chargeDash', name: '冲锋突进', atpCost: 20, cooldown: 6.5, duration: 0.35, speedMult: 6.5, hitDamage: 25, desc: '向前急冲，撞击路径上的敌人造成伤害并短暂加速' },
		passive: { id: 'adrenaline', name: '肾上腺素', desc: '生命值低于30%时移速与射速提升20%', hpThreshold: 0.3, speedBonus: 0.2, fireRateBonus: 0.2 },
		ultimate: { id: 'sporeBarrage', name: '广谱轰炸', atpCost: 100, cooldown: 42, duration: 4, dps: 34, radius: 8, desc: '在周围区域召唤持续弹幕轰炸' },
	},

	sniper: {
		id: 'sniper', name: '抗病毒狙击型', role: 'Sniper',
		desc: '高精度远程点射，弱点打击、低误伤',
		color: 0xa4ff6b, accentColor: 0xffe45c,
		maxHealth: 85, maxShield: 25, maxATP: 110, atpRegen: 10,
		moveSpeed: 6.6, sprintMult: 1.3, dodgeDistance: 6, dodgeCost: 14,
		primary: { id: 'railgun', name: '抗病毒狙击枪', damage: 42, fireRate: 1.6, atpCost: 6, projSpeed: 95, spread: 0.004, pierce: 2, critMult: 2.2, color: 0xd6ff8a },
		secondary: { id: 'markerDart', name: '标记飞镖', damage: 10, atpCost: 12, cooldown: 3, markDuration: 6, markDamageBonus: 0.35, projSpeed: 60, color: 0xffe45c },
		active: { id: 'focusZoom', name: '聚焦瞄准', atpCost: 18, cooldown: 7, duration: 3.5, critBonus: 0.35, moveSlow: 0.5, desc: '进入聚焦状态：暴击率提升，但移速降低' },
		passive: { id: 'weakpointReader', name: '弱点分析', desc: '对被标记或精英/Boss目标造成的伤害提升15%', eliteDamageBonus: 0.15 },
		ultimate: { id: 'orbitalLance', name: '轨道穿刺', atpCost: 100, cooldown: 46, damage: 260, pierceAll: true, desc: '召唤一记贯穿全场的高能穿刺打击' },
	},

	guardian: {
		id: 'guardian', name: '免疫强化守护型', role: 'Guardian',
		desc: '手术刀近战 + 护盾，强化白细胞、控场',
		color: 0xffb43f, accentColor: 0x62c6ff,
		maxHealth: 160, maxShield: 70, maxATP: 90, atpRegen: 8,
		moveSpeed: 6.8, sprintMult: 1.25, dodgeDistance: 4.5, dodgeCost: 16,
		primary: { id: 'scalpel', name: '强化手术刀', damage: 16, fireRate: 3.2, atpCost: 2.4, range: 3.2, arc: 1.4, color: 0xffd08a, melee: true },
		secondary: { id: 'aegisField', name: '守护立场', damage: 0, atpCost: 22, cooldown: 8, duration: 3, radius: 4.5, damageReduction: 0.5, allyBoost: 0.25, desc: '展开护盾力场，减免范围内伤害并强化白细胞' },
		active: { id: 'immunePulse', name: '免疫脉冲', atpCost: 24, cooldown: 9, radius: 6, stunDuration: 1.2, desc: '向外释放脉冲，眩晕周围敌人并治疗附近白细胞/血小板' },
		passive: { id: 'phagocyteBond', name: '吞噬纽带', desc: '附近的白细胞与巨噬细胞攻击力提升20%，且会优先保护你', allyDamageBonus: 0.2 },
		ultimate: { id: 'fortressProtocol', name: '堡垒协议', atpCost: 100, cooldown: 48, duration: 6, damageReduction: 0.75, tauntRadius: 10, reflectDamage: 0.3, desc: '化身堡垒：大幅减伤、嘲讽全场敌人并反弹部分伤害' },
	},
};

// ATP resource economy — how fast it drains vs. how pickups restore it.
export const ATP_ECONOMY = {
	baseRegenPerSecond: 6,
	pickups: {
		glucose: { label: '葡萄糖', restore: 18, color: 0xffe27a },
		lipid: { label: '脂肪颗粒', restore: 32, color: 0xffb14f },
		mitochondria: { label: '线粒体补给', restore: 60, color: 0x7cffb0, rare: true },
	},
	overheat: { threshold: 0.92, cooldownPenalty: 1.6 }, // primary weapons overheat near 0 ATP
};

export const ENEMIES = {
	normalVirus: {
		id: 'normalVirus', name: '普通病毒', health: 30, damage: 8, speed: 3.2,
		attackRange: 1.6, attackCooldown: 1.1, xp: 4, color: 0xd6455c, scale: 0.9,
		behavior: 'melee',
	},
	splitVirus: {
		id: 'splitVirus', name: '分裂病毒', health: 42, damage: 6, speed: 2.6,
		attackRange: 1.5, attackCooldown: 1.3, xp: 6, color: 0xb84fd6, scale: 1.05,
		behavior: 'melee', onDeathSplit: { count: 2, childId: 'normalVirus', healthFrac: 0.4 },
	},
	boomVirus: {
		id: 'boomVirus', name: '自爆病毒', health: 18, damage: 34, speed: 4.1,
		attackRange: 2.2, attackCooldown: 0, xp: 5, color: 0xff9142, scale: 0.8,
		behavior: 'suicide', fuseTime: 1.1, blastRadius: 3.4,
	},
	stealthVirus: {
		id: 'stealthVirus', name: '隐形病毒', health: 26, damage: 14, speed: 3.6,
		attackRange: 1.7, attackCooldown: 1.6, xp: 7, color: 0x8fa8ff, scale: 0.9,
		behavior: 'stealth', cloakOpacity: 0.12, revealRadius: 3,
	},
	shieldVirus: {
		id: 'shieldVirus', name: '护盾病毒', health: 46, damage: 10, speed: 2.2,
		attackRange: 1.6, attackCooldown: 1.4, xp: 8, color: 0x5fd6c8, scale: 1.1,
		behavior: 'shielded', shieldHealth: 40, shieldRegenDelay: 5,
	},
	parasiteVirus: {
		id: 'parasiteVirus', name: '寄生病毒', health: 24, damage: 5, speed: 3.0,
		attackRange: 1.4, attackCooldown: 2.2, xp: 7, color: 0x9dff5f, scale: 0.85,
		behavior: 'parasite', latchDuration: 3, drainPerSecond: 6,
	},
	healerVirus: {
		id: 'healerVirus', name: '治疗病毒', health: 34, damage: 4, speed: 2.4,
		attackRange: 5, attackCooldown: 2.5, xp: 8, color: 0x6bffb0, scale: 0.95,
		behavior: 'support', healAmount: 12, healRadius: 6,
	},
	eliteInfected: {
		id: 'eliteInfected', name: '精英感染体', health: 140, damage: 20, speed: 2.9,
		attackRange: 2, attackCooldown: 1.0, xp: 25, color: 0xff2f6d, scale: 1.6,
		behavior: 'melee', elite: true, enrageHpFrac: 0.3, enrageSpeedMult: 1.4,
	},
};

export const BOSSES = {
	necroCore: {
		id: 'necroCore', name: '坏死核心', health: 2200, scale: 3.2, color: 0x7a1440,
		phases: [
			{ name: 'phase1', hpAbove: 0.6, moveSpeed: 2.4, attacks: [ 'slam', 'sporeBurst' ], attackInterval: [ 2.2, 3.4 ] },
			{ name: 'phase2', hpAbove: 0.3, moveSpeed: 3.0, attacks: [ 'slam', 'sporeBurst', 'summonAdds' ], attackInterval: [ 1.8, 2.8 ] },
			{ name: 'enrage', hpAbove: 0, moveSpeed: 4.2, attacks: [ 'slam', 'sporeBurst', 'summonAdds', 'chargeSweep' ], attackInterval: [ 1.1, 1.8 ], damageMult: 1.3, tint: 0xff2222 },
		],
		attacksData: {
			slam: { damage: 30, radius: 4.5, telegraph: 0.9 },
			sporeBurst: { damage: 14, projectileCount: 12, projSpeed: 14, telegraph: 0.6 },
			summonAdds: { count: 3, enemyId: 'normalVirus', telegraph: 0.5 },
			chargeSweep: { damage: 26, telegraph: 0.7, speedMult: 5 },
		},
	},
};

// Roguelike in-room upgrade pool. `apply(player)` mutates live player stats;
// keep effects small/composable so 3-choice rooms stay meaningfully different.
export const UPGRADES = [
	{ id: 'ricochet', name: '弹射弹道', desc: '子弹命中后有几率弹射到附近敌人', rarity: 'common', apply: ( p ) => { p.mods.ricochetChance = ( p.mods.ricochetChance || 0 ) + 0.25; } },
	{ id: 'critUp', name: '精准打击', desc: '暴击率 +12%', rarity: 'common', apply: ( p ) => { p.mods.critChance = ( p.mods.critChance || 0.05 ) + 0.12; } },
	{ id: 'wbcDamage', name: '免疫增效', desc: '附近白细胞伤害 +30%', rarity: 'common', apply: ( p ) => { p.mods.allyDamageBonus = ( p.mods.allyDamageBonus || 0 ) + 0.3; } },
	{ id: 'atpRegenUp', name: '代谢加速', desc: 'ATP 回复速度 +25%', rarity: 'common', apply: ( p ) => { p.mods.atpRegenMult = ( p.mods.atpRegenMult || 1 ) + 0.25; } },
	{ id: 'cooldownDown', name: '酶促反应', desc: '技能冷却 -15%', rarity: 'rare', apply: ( p ) => { p.mods.cooldownMult = ( p.mods.cooldownMult || 1 ) * 0.85; } },
	{ id: 'elemFreeze', name: '低温附加', desc: '攻击附加冰冻效果，减速命中的敌人', rarity: 'rare', apply: ( p ) => { p.mods.element = 'freeze'; } },
	{ id: 'elemBurn', name: '灼烧附加', desc: '攻击附加持续灼烧伤害', rarity: 'rare', apply: ( p ) => { p.mods.element = 'burn'; } },
	{ id: 'elemShock', name: '电击附加', desc: '攻击附加连锁电击，可跳跃到附近敌人', rarity: 'rare', apply: ( p ) => { p.mods.element = 'shock'; } },
	{ id: 'elemCorrode', name: '腐蚀附加', desc: '攻击附加腐蚀效果，降低敌人护甲', rarity: 'rare', apply: ( p ) => { p.mods.element = 'corrode'; } },
	{ id: 'maxHpUp', name: '细胞增殖', desc: '最大生命值 +20', rarity: 'common', apply: ( p ) => { p.maxHealth += 20; p.health += 20; } },
	{ id: 'maxShieldUp', name: '膜蛋白强化', desc: '最大护盾 +18', rarity: 'common', apply: ( p ) => { p.maxShield += 18; p.shield += 18; } },
	{ id: 'lifesteal', name: '再生因子', desc: '造成伤害时回复少量生命', rarity: 'rare', apply: ( p ) => { p.mods.lifesteal = ( p.mods.lifesteal || 0 ) + 0.06; } },
	{ id: 'pierceUp', name: '穿透弹头', desc: '子弹穿透次数 +1', rarity: 'common', apply: ( p ) => { p.mods.pierceBonus = ( p.mods.pierceBonus || 0 ) + 1; } },
	{ id: 'moveSpeedUp', name: '流体动力', desc: '移动速度 +10%', rarity: 'common', apply: ( p ) => { p.moveSpeed *= 1.1; } },
	{ id: 'ultimateChargeUp', name: '能量共振', desc: '终极技能获取能量速度 +30%', rarity: 'rare', apply: ( p ) => { p.mods.ultChargeMult = ( p.mods.ultChargeMult || 1 ) + 0.3; } },
];

export const ROOM_TYPES = [ 'combat', 'elite', 'supply', 'event', 'shop', 'hidden' ]; // 'boss' is appended by RoomManager as the final node

export const BIOMES = {
	bloodVessel: {
		id: 'bloodVessel', name: '血管', fogColor: 0x30060f, fogDensity: 0.028,
		ambientColor: 0x552030, keyColor: 0xff6b81, floorColor: 0x2a0812, wallColor: 0x4a1020,
		bossId: 'necroCore', bgm: 'vessel',
	},
	lung: {
		id: 'lung', name: '肺部', fogColor: 0x082a2c, fogDensity: 0.024,
		ambientColor: 0x1c4f52, keyColor: 0x5cf2ff, floorColor: 0x0a2224, wallColor: 0x123c40,
		bossId: 'necroCore', bgm: 'lung',
	},
	liver: {
		id: 'liver', name: '肝脏', fogColor: 0x2c2206, fogDensity: 0.026,
		ambientColor: 0x554010, keyColor: 0xffcf4d, floorColor: 0x241a08, wallColor: 0x40300f,
		bossId: 'necroCore', bgm: 'liver',
	},
};

export const RUN_STRUCTURE = [ 'bloodVessel', 'lung', 'liver' ]; // three acts, final boss caps act 3

export const ECOSYSTEM = {
	redBloodCell: { health: 20, speed: 2.0, color: 0xff3b4e, scale: 0.55, healthImpactOnDeath: 4 },
	whiteBloodCell: { health: 60, speed: 3.4, damage: 12, attackRange: 2, attackCooldown: 1.0, color: 0xf5f5f5, scale: 0.8, aggroRadius: 9 },
	platelet: { health: 15, speed: 2.6, color: 0xffd479, scale: 0.4, repairRate: 8, repairRadius: 3 },
	macrophage: { health: 90, speed: 2.2, damage: 18, attackRange: 2.2, attackCooldown: 1.4, color: 0xc9a6ff, scale: 1.1, aggroRadius: 7, eatsWeakEnemies: true, healthThresholdFrac: 0.25 },
	dendriticCell: { health: 40, speed: 1.6, color: 0x9dffe0, scale: 0.9, alertRadius: 8, alertCooldown: 6, summonCount: 2 },
};

export function cloneUpgradePool() {
	return UPGRADES.slice();
}
