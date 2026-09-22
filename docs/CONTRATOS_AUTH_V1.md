# Contrato `/api/v1/auth` — fundação operacional V1

Todas as mutações recebem JSON UTF-8 (`Content-Type: application/json`) até 16 KiB e `Origin` igual a `APP_ORIGIN`. Erros usam `{code,message,requestId,schemaVersion:"1"}` e `Cache-Control: no-store`. Os códigos de erro possíveis incluem `INVALID_INPUT` (400), `UNAUTHENTICATED`/`INVALID_CREDENTIALS`/`SESSION_REPLAY` (401), `ORIGIN_REJECTED`/`CROSS_SITE_REJECTED` (403), `RATE_LIMITED` (429), `BODY_TOO_LARGE` (413), `JSON_REQUIRED` (415) e `INTERNAL_ERROR` (500). Respostas de cadastro e pedido de recuperação são genéricas para não revelar existência de conta. Tokens nunca são devolvidos por essas respostas; verificação/recuperação chegam somente pelo canal SMTP configurado.

| Método e rota | Entrada estrita | Sucesso | Sessão / idempotência |
| --- | --- | --- | --- |
| POST `/register` | `{email:string,password:string}` | 202 `{schemaVersion:"1",accepted:true}` | sem sessão; e-mail canônico único, registro repetido responde igual sem criar nova conta |
| POST `/verify-email` | `{token:string}` | 204 | token de uso único; replay negado |
| POST `/login` | `{email:string,password:string}` | 200 `{userId,schemaVersion}` + cookie de sessão | sem sessão; cada login válido cria sessão nova deliberadamente; não armazenar token em resposta replay |
| POST `/logout` | `{}` | 204 + cookie apagado | cookie atual ou expirado; operação repetida não reativa sessão |
| POST `/rotate` | `{}` | 204 + cookie novo | sessão atual; token anterior revogado, replay revoga família |
| POST `/request-reset` | `{email:string}` | 204 | sem sessão; resposta genérica, pedido repetido pode gerar novo token limitado por quota |
| POST `/reset-password` | `{token:string,password:string}` | 204 | token de uso único; sessões e outros tokens de reset invalidados |

`email` é validado e normalizado; senha tem 12–1024 caracteres; tokens têm formato opaco de 43 caracteres. Cookies são `HttpOnly`, `SameSite=Lax`, `Path=/`; em produção recebem `Secure` e prefixo `__Host-`. Mutações autenticadas do restante da API exigem sessão verificada e conta ativa. Sessões expiram e são rotacionáveis/revogáveis. Tentativas são limitadas por e-mail e por orçamento global técnico; a proteção distribuída adicional pertence à borda operacional.

Os links enviados pelo worker apontam para `/verificar-email#token=...` e `/nova-senha#token=...`; o fragmento não é enviado ao servidor na navegação e as páginas o removem da URL após captura. Links antigos com query ainda são aceitos e a query também é removida. Essas páginas usam `Referrer-Policy: no-referrer` e `Cache-Control: no-store`. SMTP real, TLS/HTTPS, segredos e worker são pré-condições para receber usuários de teste; `.env.*.example` contém apenas formatos. Não existe autorização para criar `ADMIN`/`MODERATOR` via cadastro.
