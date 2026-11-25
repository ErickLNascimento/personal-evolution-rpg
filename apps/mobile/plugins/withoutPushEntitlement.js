// Remove a capability de Push Notifications (aps-environment) nos builds locais.
// O Personal Team grátis da Apple não aceita essa capability, e o app só usa
// notificações locais (lembretes), que funcionam sem ela. Builds do EAS mantêm.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    if (!process.env.EAS_BUILD) delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
