# Operação do Motor Matemático V1

## Inicialização segura

Carregue as flags por secret manager ou variáveis de ambiente do processo. Use `parseMathFeatureFlags` e `assertMathPublicationDisabled` no bootstrap. Nunca copie URLs de banco, chaves, tokens ou parâmetros privados para o repositório. Em homologação, o banco deve ser isolado e as fixtures devem permanecer marcadas como `TEST_ONLY`.

## Observabilidade

Monitore somente agregados: duração e erro do job por `engineVersion`, quantidade por estado (`INITIAL`, `EVALUATION`, `SUFFICIENT`), falhas de validação, fila de reprocessamento, correções pendentes, backup e restauração. Use `requestId`, `jobId` e hashes opacos. Não monitore IDs de pessoas, respostas, gabaritos, vetores, γ, parâmetros de shrinkage ou intervalos individuais.

Alertas operacionais mínimos: falha de migração, falha de backup, restauração não verificável, crescimento persistente de erros 5xx, job interrompido, divergência de checksum e tentativa de abrir gate de publicação. Cada alerta deve apontar para um runbook e não liberar automaticamente qualquer flag.

## Rollback e incidente

Interrompa publicação e jobs novos, preserve os snapshots, capture o `jobId` e o `engineVersion`, e abra auditoria. Reprocesse em banco isolado antes de qualquer correção. Rollback de aplicação não remove migrações nem snapshots; restauração de backup exige verificação de checksum e contagem de registros. A política jurídica provisória não deve ser transformada em retenção automática por este procedimento.

## Gates ainda bloqueados

Não há remoto Git configurado no estado local, portanto CI hospedado, proteção de branches e alertas hospedados não podem ser atestados. Usuários reais, catálogo oficial, aviso jurídico aprovado, revisão LGPD, produção hospedada e publicação de métricas continuam bloqueados.
