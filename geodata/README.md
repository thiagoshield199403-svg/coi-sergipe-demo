# geodata/ — GeoJSON estático das regionais (MAPA OPERACIONAL)

Cada subpasta é uma regional (polo). O arquivo esperado dentro de cada uma é
`<slug>.geojson`, um `FeatureCollection` onde cada `Feature.properties` inclui
um campo `slug_geojson` cujo valor bate com `localidades.slug_geojson`
(coluna do banco) — é essa string que amarra uma feature geográfica a uma
linha de `localidades`, nunca um ID posicional nem nome livre.

**Nenhum arquivo `.geojson` real foi adicionado ainda** — nenhum GeoJSON
oficial/confiável foi fornecido para nenhuma regional até o momento desta
etapa. Cada pasta abaixo existe só como destino já preparado; o frontend
(`js/mapa.js`, `mapaCarregarGeoJSON()`) tenta buscar `geodata/<slug>/<slug>.geojson`
e, se não encontrar (404), simplesmente não desenha o polígono daquela
regional — o mapa continua funcionando com marcadores/lista, nunca quebra.

Quando um GeoJSON real for fornecido:

1. Salvar como `geodata/<slug>/<slug>.geojson`.
2. Preencher `localidades.slug_geojson` das linhas correspondentes (script
   simples de UPDATE, sem migration de schema).
3. Nada mais muda — o frontend já sabe carregar o arquivo assim que ele existir.

Nenhum limite territorial foi inventado nesta etapa.
