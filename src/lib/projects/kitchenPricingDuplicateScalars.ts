/**
 * Kitchen pricing row fields that must survive POST /api/projects/duplicate.
 * New columns on KitchenPricingProject should be wired through here and tested.
 */
export type KitchenPricingDuplicateSource = {
  roomDefaults: unknown;
  includeInstallation: boolean;
  installationTbd: boolean;
  includeDelivery: boolean;
  deliveryTbd: boolean;
  deliveryCost: number | null;
  multiplier: number;
  discountPercent: number;
  discountReason: string | null;
};

export function kitchenPricingProjectDuplicateScalars(
  kpp: KitchenPricingDuplicateSource
): KitchenPricingDuplicateSource {
  return {
    roomDefaults: kpp.roomDefaults,
    includeInstallation: kpp.includeInstallation,
    installationTbd: kpp.installationTbd,
    includeDelivery: kpp.includeDelivery,
    deliveryTbd: kpp.deliveryTbd,
    deliveryCost: kpp.deliveryCost,
    multiplier: kpp.multiplier,
    discountPercent: kpp.discountPercent,
    discountReason: kpp.discountReason,
  };
}
