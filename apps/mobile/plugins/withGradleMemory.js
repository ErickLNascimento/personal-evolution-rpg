// Config plugin: limita memória e paralelismo do Gradle no build Android.
// Nos servidores do EAS, o Gradle, o daemon do Kotlin e as compilações C++ (Reanimated,
// Worklets, Skia) rodando juntos estouravam a memória e o processo era morto
// ("Gradle build daemon disappeared unexpectedly"). Menos tarefas simultâneas resolve,
// ao custo de um build um pouco mais lento.
const { withGradleProperties } = require('expo/config-plugins');

const SETTINGS = {
  'org.gradle.jvmargs': '-Xmx3072m -XX:MaxMetaspaceSize=768m -XX:+HeapDumpOnOutOfMemoryError',
  'org.gradle.parallel': 'false',
  'org.gradle.workers.max': '2',
  'kotlin.daemon.jvmargs': '-Xmx1536m',
};

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(SETTINGS)) {
      const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
