# Observabilidade do Radar V1 em teste

Os eventos de auditoria e notificações registram identificadores opacos, tipo, instante e estado. Logs HTTP usam `requestId` e códigos de erro. Nenhum log ou métrica deve incluir senha, token, texto de resposta própria, gabarito do alvo, vetor de probabilidade ou texto de consentimento.

Os operadores devem acompanhar por janela de tempo, em agregados sem identificadores pessoais: convites criados/aceitos/recusados, concessões e revogações, tentativas bloqueadas por regra, snapshots confirmados, notificações pendentes e falhas HTTP por código. Consultas de diagnóstico ao banco exigem papel administrativo e execução fora do processo web. Alertas iniciais são condições operacionais, não metas de produto: aumento persistente de falhas 5xx, erro de migração, crescimento da fila de e-mail, falha de backup ou indisponibilidade da conexão PostgreSQL impedem abrir o ambiente de teste.

`corepack pnpm radar:metrics [horas]` emite agregados JSON de eventos Radar e estados da inbox, usando somente a URL administrativa no processo do operador. O valor padrão é 24 horas e o máximo é 720; o script não retorna IDs de pessoas ou conteúdo das respostas. O monitor hospedado e seus alertas ainda dependem da infraestrutura de implantação.

Para o motor matemático, acompanhe somente duração, erro e quantidade agregada por `engineVersion`, estado de evidência, fila de reprocessamento, correções pendentes e divergências de checksum. As flags de publicação estão centralizadas em `src/lib/math-feature-flags.ts`; todos os gates de publicação, ranking, reputação matemática, catálogo oficial e homologação real permanecem fechados. Uma tentativa de abri-los deve falhar no bootstrap e gerar alerta operacional sem expor a configuração completa.

Antes de qualquer ambiente hospedado, definir destino de logs, acesso restrito, política jurídica de retenção e procedimento de incidente. O repositório não tem remoto Git configurado nesta etapa; por isso, a execução do CI remoto e dos alertas hospedados não pode ser atestada localmente.
