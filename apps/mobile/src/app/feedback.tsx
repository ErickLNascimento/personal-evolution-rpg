import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABEL,
  FEEDBACK_MAX,
  validateFeedback,
  type FeedbackKind,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import { sendFeedback } from '@/features/feedback/api';
import { typography } from '@/theme/tokens';

const KIND_OPTIONS = FEEDBACK_KINDS.map((k) => ({ value: k, label: FEEDBACK_KIND_LABEL[k] }));

const PLACEHOLDER: Record<FeedbackKind, string> = {
  bug: 'O que aconteceu? Em qual tela? O que você esperava que acontecesse?',
  ideia: 'Conte a sua ideia: o que gostaria de ver no app?',
  elogio: 'O que você mais gostou até agora?',
  outro: 'Escreva aqui.',
};

/** Feedback dos testadores: tipo + texto livre. A equipe lê pelo painel do Supabase. */
export default function FeedbackScreen() {
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const invalid = validateFeedback(message);
    if (invalid) return setError(invalid);
    setError(null);
    setSending(true);
    const err = await sendFeedback(kind, message);
    setSending(false);
    if (err) return setError(err);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  }

  if (sent) {
    return (
      <StackScreen>
        <Text style={typography.heading}>Obrigado!</Text>
        <Text style={typography.body}>
          Seu feedback chegou para a equipe. Cada relato ajuda a deixar a jornada melhor.
        </Text>
        <Button title="Voltar" onPress={() => router.back()} />
        <Button
          title="Enviar outro"
          variant="secondary"
          onPress={() => {
            setMessage('');
            setSent(false);
          }}
        />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <Text style={typography.body}>
        Encontrou um problema, teve uma ideia ou quer contar o que achou? Escreva aqui — a equipe lê
        tudo.
      </Text>
      <Chips options={KIND_OPTIONS} selected={[kind]} onToggle={setKind} />
      <Field
        label="Sua mensagem"
        value={message}
        onChangeText={setMessage}
        placeholder={PLACEHOLDER[kind]}
        multiline
        maxLength={FEEDBACK_MAX}
        textAlignVertical="top"
        style={styles.message}
      />
      <Text style={typography.caption}>
        {message.trim().length}/{FEEDBACK_MAX} · A versão do app e o sistema do aparelho vão junto,
        para ajudar a investigar.
      </Text>
      <FormMessage text={error} />
      <Button title="Enviar feedback" onPress={submit} loading={sending} />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  message: { minHeight: 140 },
});
