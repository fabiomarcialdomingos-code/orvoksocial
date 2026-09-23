# Proposta de instrumento Radar Base V1 — `PROPOSTA_PARA_APROVACAO`

Status: proposta não oficial. Este arquivo não autoriza publicação, seed ou uso com pessoas reais.
Versão candidata: `RADAR_BASE_V1-CANDIDATE-2026-09-22`.

## Regras comuns

Cada item usa a mesma instrução: “Considerando os últimos 12 meses e situações que você realmente observou, qual opção descreve melhor a frequência deste comportamento?”. Opções: `1 Nunca`, `2 Raramente`, `3 Às vezes`, `4 Frequentemente`, `5 Quase sempre`, `NÃO SEI / NÃO TENHO INFORMAÇÃO`. A opção de informação insuficiente é uma resposta explícita e não pode ser convertida em valor numérico.

Os itens descrevem comportamento situado. Não há diagnóstico, traço clínico, capacidade profissional, saúde, renda, crédito, risco ou valor moral. A classificação “sensibilidade” abaixo é uma classificação de governança, não uma conclusão jurídica: todos os itens são dados pessoais comportamentais quando associados a uma pessoa e devem permanecer protegidos até parecer jurídico.

| ID | Texto candidato | Categoria | Sensibilidade de governança | Risco de viés a testar |
|---|---|---|---|---|
| RH-B01 | Ao tomar uma decisão importante, busca informação adicional antes de agir? | decisão | comportamental, não especial por si só | escolaridade, acesso a informação e contexto econômico |
| RH-B02 | Ao receber informação que contraria sua expectativa, reconsidera sua posição? | atualização | comportamental | diferença cultural na forma de discordar |
| RH-B03 | Ao assumir compromisso, cumpre o prazo combinado? | compromisso | comportamental | acesso desigual a recursos e imprevistos |
| RH-B04 | Ao perceber erro próprio, reconhece-o e procura corrigi-lo? | correção | comportamental | assimetria de poder e segurança para admitir erro |
| RH-B05 | Em conversa difícil, escuta a outra perspectiva antes de responder? | diálogo | comportamental | idioma, neurodiversidade e estilos de comunicação |
| RH-B06 | Em desacordo de grupo, procura solução aceitável para os envolvidos? | cooperação | comportamental | cultura de negociação e posição hierárquica |
| RH-B07 | Em tarefa com várias etapas, acompanha o que ainda precisa ser feito? | organização | comportamental | recursos, acessibilidade e divisão de trabalho |
| RH-B08 | Quando planos mudam, ajusta o próximo passo sem abandonar o objetivo? | adaptação | comportamental | precariedade, controle sobre o contexto e acessibilidade |
| RH-B09 | Ao fazer estimativa, declara o quanto está incerta? | incerteza | comportamental; não habilidade matemática | familiaridade com probabilidades e linguagem |
| RH-B10 | Quando há evidência relevante, usa-a para justificar uma conclusão? | evidência | comportamental | acesso a fontes e diferenças de letramento |
| RH-B11 | Quando alguém precisa de ajuda em compromisso combinado, responde em tempo razoável? | reciprocidade | comportamental | fuso, trabalho, conectividade e definição de “razoável” |
| RH-B12 | Ao receber crítica específica e respeitosa, considera uma mudança concreta? | aprendizado | comportamental | poder, segurança psicológica e contexto da crítica |

## Critérios de não publicação

O catálogo só pode ser promovido para `RADAR_BASE_V1` após: aprovação explícita de Produto e Governança; revisão de linguagem; teste cognitivo com participantes de teste; análise de dependência entre itens; revisão de viés e acessibilidade; parecer jurídico sobre finalidade, base legal, sensibilidade e direitos; definição do aviso correspondente; manifesto com IDs, texto normalizado, opções, ordem, versão e SHA-256; e teste de importação que recuse qualquer item faltante, duplicado ou alterado.

O importador deve aceitar esta proposta apenas como `PROPOSTA_PARA_APROVACAO`/`CANDIDATE`. A promoção precisa ser uma decisão versionada e assinada, com migração ou comando de publicação auditado. Nenhuma tela deve mostrar “oficial” enquanto o status não for `APPROVED`.

## Critérios de teste do instrumento

1. Rejeitar texto vazio, duplicidade de ID, versão repetida, opção ausente e alteração de conteúdo após congelamento.
2. Preservar `NÃO SEI / NÃO TENHO INFORMAÇÃO` sem cálculo derivado.
3. Garantir que respostas e catálogo tenham hash e versão imutáveis.
4. Impedir publicação em `APP_ENV=production` enquanto a decisão formal e o parecer jurídico não existirem.
5. Verificar leitura autorizada A/B/C e ausência de vazamento em logs, notificações, exportação de terceiros e snapshots.
6. Registrar uma análise de sensibilidade e uma decisão de recalibração antes de qualquer métrica pública.

