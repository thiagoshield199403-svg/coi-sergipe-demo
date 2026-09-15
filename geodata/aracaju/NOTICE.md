# Fontes desta pasta (geradas por app/scripts/importar_geodata_real.py)

## IBGE — malha territorial oficial (limite de município)
https://servicodados.ibge.gov.br/api/v3/malhas/
Municípios usados nesta pasta: Aracaju, Barra dos Coqueiros, Itaporanga d'Ajuda, Nossa Senhora do Socorro, São Cristóvão

## OpenStreetMap — limites de bairro/localidade (via Overpass API)
(c) colaboradores do OpenStreetMap, licença ODbL — https://www.openstreetmap.org/copyright
Consulta: relations boundary=administrative, admin_level=10, dentro da área do município.

## Pendências de correspondência territorial (auditoria somente-leitura, etapa de conferência)

Comparação entre o catálogo operacional (`localidades`, ver `backend/app/models/localidade.py`) e as feições deste `aracaju.geojson`. Nenhuma correspondência abaixo foi decidida por semelhança de nome — só por evidência objetiva no próprio dado de origem (tags OSM, ver `.geodata_bruto_cache/osm_Aracaju.json`, cache local não versionado). Sem essa evidência, a divergência fica registrada aqui como pendência, não corrigida automaticamente (ver `js/mapas-regionais.js`, bloco `REGTM_ALIASES_CONFIRMADOS`, para a mesma explicação do lado do código).

- **`Dom Luciano`** — feição presente neste GeoJSON (bairro/loteamento de Aracaju, relation OSM id `14618043`, tags `admin_level=10`, `boundary=administrative`, `place` ausente), **sem nenhuma localidade correspondente no catálogo operacional atual**. Não é um erro de casamento: é uma feição territorial real que ainda não tem representação cadastrada no catálogo. Continua sem associação — quem for cadastrar uma nova localidade para esse bairro pode reaproveitar esta feição pelo nome `"Dom Luciano"` (ou por `slug_geojson`, se preferir vínculo explícito).
- **`Dezoito do Forte`** (catálogo) vs. **`18 do Forte`** (feição deste GeoJSON, relation OSM id `4023050`) — mesmo bairro citado na especificação original do projeto ("18 do Forte", RJPS 04), tratado no seed histórico (`backend/alembic/versions/eab8906c2bf9_...py`) como o mesmo bairro já cadastrado como "Dezoito do Forte", mas **sem confirmação por tag de origem** (`18 do Forte` não tem `loc_name`/`alt_name`/`old_name` apontando para "Dezoito do Forte" nas tags OSM brutas). Mantido como pendência — se forem lugares distintos, precisa ajuste manual; se forem o mesmo, precisa de evidência adicional (documento oficial de bairros, por exemplo) antes de virar alias confirmado.
- **`Matapuã`** (catálogo) vs. **`Matapoã`** (feição deste GeoJSON, relation OSM id `14618360`) — provável variante de grafia do mesmo bairro, mas sem tag de origem confirmando. Mesma pendência do item acima.

Correspondência **já confirmada** como exemplo do padrão exigido: **`Bugio`** (catálogo) = **`Assis Chateaubriand`** (feição deste GeoJSON, relation OSM id `4023044`) — a própria feição carrega a tag `loc_name="Bugio"`, o nome popular gravado na origem pelo OpenStreetMap. Aplicado em `js/mapas-regionais.js` (`REGTM_ALIASES_CONFIRMADOS`), sem alterar o nome exibido ao usuário (que continua "Bugio", o nome oficial do catálogo).
