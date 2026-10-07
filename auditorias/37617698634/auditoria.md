# Auditoria do site real (Lighthouse, celular, rede móvel simulada)

```
== imagem de prévia do convite (código de teste) ==
status=200 tipo=image/png bytes=108243 tempo=4.909509s
== etiquetas na home ==
<h1                        0
rel="canonical"            0
property="og:title"        0
property="og:image"        0
name="twitter:card"        0
name="description"         1
== arquivos públicos ==
/robots.txt            404
/sitemap.xml           404
/favicon.ico           404
/manifest.webmanifest  200
== tempo até o primeiro byte (5 medições) ==
/ 0.376026
/ 0.381662
/ 0.048375
/ 0.052940
/ 0.058258
/comecar 0.486609
/comecar 0.620241
/comecar 0.141440
/comecar 0.318887
/comecar 0.211531
```


## /  (2 rodadas, mediana)

| Categoria | Nota |
|---|---|
| performance | 64 |
| accessibility | 100 |
| best-practices | 100 |
| seo | 100 |

| Métrica | Valor |
|---|---|
| Primeira pintura (FCP) | 2.64 s |
| Maior conteúdo (LCP) | 2.87 s |
| Bloqueio de interação (TBT) | 1882 ms |
| Deslocamento de layout (CLS) | 0.004 |
| Speed Index | 6.94 s |
| Interativo (TTI) | 6.14 s |

**Itens que falharam (não-desempenho):**

- nenhum

**Oportunidades de desempenho:**

- `unused-javascript` Reduce unused JavaScript Est savings of 75 KiB
- `legacy-javascript` Avoid serving legacy JavaScript to modern browsers Est savings of 12 KiB

## /comecar  (3 rodadas, mediana)

| Categoria | Nota |
|---|---|
| performance | 72 |
| accessibility | 98 |
| best-practices | 100 |
| seo | 100 |

| Métrica | Valor |
|---|---|
| Primeira pintura (FCP) | 1.06 s |
| Maior conteúdo (LCP) | 4.83 s |
| Bloqueio de interação (TBT) | 417 ms |
| Deslocamento de layout (CLS) | 0.000 |
| Speed Index | 1.06 s |
| Interativo (TTI) | 4.84 s |

**Itens que falharam (não-desempenho):**

- [accessibility] `skip-link` Skip links are not focusable.

**Oportunidades de desempenho:**

- `render-blocking-resources` Eliminate render-blocking resources Est savings of 0 ms