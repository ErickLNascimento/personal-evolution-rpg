// Config plugin (só para builds locais no Windows): aponta o Gradle para um CMake mais novo.
// O CMake 3.22.1 padrão do Android traz um ninja que não aceita caminhos com mais de 260
// caracteres, e o código nativo do React Native gera caminhos assim. Com o CMake 3.31+
// (instalado pelo SDK Manager do Android Studio) e os caminhos longos ligados no Windows,
// o build local funciona.
//
// Defina na sua máquina a variável ANDROID_CMAKE_DIR com a pasta do CMake, por exemplo:
//   C:\Users\<você>\AppData\Local\Android\Sdk\cmake\3.31.6
// Sem a variável (como no EAS), o plugin não faz nada.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/** Escapa um caminho do Windows para o formato .properties (C\:\\Users\\...). */
function toProperty(p) {
  return p.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}

module.exports = function withLocalCmake(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const cmakeDir = process.env.ANDROID_CMAKE_DIR;
      if (!cmakeDir) return cfg;

      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
      const props = new Map(
        lines.filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l]),
      );
      const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (!props.has('sdk.dir') && sdk) props.set('sdk.dir', `sdk.dir=${toProperty(sdk)}`);
      props.set('cmake.dir', `cmake.dir=${toProperty(cmakeDir)}`);
      fs.writeFileSync(file, [...props.values()].join('\n') + '\n');
      return cfg;
    },
  ]);
};
