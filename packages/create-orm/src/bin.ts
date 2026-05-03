import { getConfig, init, greetAfterInstall } from 'create-orchid-orm';

getConfig().then(
  (config) => config && init(config).then(() => greetAfterInstall(config)),
);
