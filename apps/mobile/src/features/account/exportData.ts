import { dataExportFileName, type LocalDate } from '@per/domain';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

/** Quanto tempo o link do arquivo vale (segundos). */
const LINK_SECONDS = 10 * 60;

/**
 * Exportação dos dados pessoais (LGPD): o banco junta tudo o que é do usuário
 * (export_my_data), o app guarda o JSON na pasta privada dele no Storage (bucket `exports`)
 * e abre um link temporário; o navegador baixa o arquivo.
 * Devolve uma mensagem de erro, ou `null` se abriu o download.
 */
export async function exportMyData(userId: string, today: LocalDate): Promise<string | null> {
  if (!supabase) return t('dataExport.signedOut');
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) {
    if (error.code === 'PR050') return t('dataExport.disabled');
    if (/network|fetch/i.test(error.message)) return t('common.noConnection');
    return t('dataExport.collect');
  }

  // Um arquivo por usuário (sobrescrito a cada pedido): não acumula cópias no servidor.
  const path = `${userId}/dados.json`;
  const bucket = supabase.storage.from('exports');
  const upload = await bucket.upload(path, JSON.stringify(data, null, 2), {
    contentType: 'application/json',
    upsert: true,
  });
  if (upload.error) return t('dataExport.prepare');

  const link = await bucket.createSignedUrl(path, LINK_SECONDS, {
    download: dataExportFileName(today),
  });
  if (link.error || !link.data?.signedUrl) return t('dataExport.link');
  await Linking.openURL(link.data.signedUrl);
  return null;
}
