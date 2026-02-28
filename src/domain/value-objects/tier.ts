export class Tier {
  static readonly TIER_0 = new Tier(0, 'Auto-approved')
  static readonly TIER_1 = new Tier(1, 'Silent')
  static readonly TIER_2 = new Tier(2, 'One-tap')
  static readonly TIER_3 = new Tier(3, 'Confirm')
  static readonly TIER_4 = new Tier(4, 'Quorum')

  private constructor(
    public readonly level: number,
    public readonly name: string
  ) {
    Object.freeze(this)
  }

  static from(level: number): Tier {
    if (!Number.isInteger(level)) {
      throw new Error('Invalid tier')
    }

    switch (level) {
      case 0:
        return new Tier(0, 'Auto-approved')
      case 1:
        return new Tier(1, 'Silent')
      case 2:
        return new Tier(2, 'One-tap')
      case 3:
        return new Tier(3, 'Confirm')
      case 4:
        return new Tier(4, 'Quorum')
      default:
        throw new Error('Invalid tier')
    }
  }

  requiresHITL(): boolean {
    return this.level >= 2
  }
}
