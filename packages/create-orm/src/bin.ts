import { getConfig, init, greetAfterInstall } from 'create-orchid-orm/lib';

getConfig().then(
  (config) => config && init(config).then(() => greetAfterInstall(config)),
);
