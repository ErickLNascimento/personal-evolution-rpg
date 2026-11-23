import { DELETE_ACCOUNT_WORD, isDeleteConfirmation } from '@per/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Field, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import { deleteAccount } from '@/features/account/deleteAccount';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Confirmação de exclusão em tela própria (modal): o aviso fica no topo e o campo logo abaixo,
 * para tudo caber acima do teclado. Com sucesso, a sessão some e o app volta para o login.
 */
export default function DeleteAccountScreen() {
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = isDeleteConfirmation(text);

  async function confirmDelete() {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    const err = await deleteAccount(text);
    if (err) {
      setDeleting(false);
      setError(err);
    }
  }

  return (
    <StackScreen>
      <View style={styles.warning}>
        <Text style={typography.heading}>Isto não pode ser desfeito</Text>
        <Text style={typography.body}>
          Sua conta e todos os dados serão apagados para sempre: perfil, objetivos, hábitos, registros, XP e planos da IA.
        </Text>
      </View>

      <Field
        label={`Digite ${DELETE_ACCOUNT_WORD} para confirmar`}
        value={text}
        onChangeText={setText}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="done"
        onSubmitEditing={confirmDelete}
      />
      <FormMessage text={error} />

      <Button
        title="Excluir definitivamente"
        onPress={confirmDelete}
        variant="danger"
        loading={deleting}
        disabled={!confirmed}
      />
      <Button title="Cancelar" onPress={() => router.back()} variant="secondary" disabled={deleting} />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  warning: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
});
