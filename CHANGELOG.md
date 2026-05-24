# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-05-24

### Fixed

- **`createAuthFixture`**: corrige erro de runtime do Playwright "First argument must use the object destructuring pattern" no callback da fixture `payload`. O parâmetro nomeado `_workerContext` foi substituído por `{}`.

## [0.1.0] - 2026-05-24

### Added

- **`BaseCollectionPage`**: classe base abstrata para Page Object Model de
  collections do Payload CMS, com métodos para navegação (`gotoList`,
  `gotoCreate`), salvamento (`save`), exclusão (`delete`), verificação em
  listagem (`verifyInList`, `verifyNotInList`) e troca de abas (`switchTab`).
- **`createAuthFixture`**: factory que retorna um `test` estendido do
  Playwright com as fixtures `payload` (worker: inicialização da API Local)
  e `authenticatedPage` (teste: criação de usuário dinâmico, login via UI,
  teardown com deleção do usuário). Aceita `CreateAuthFixtureOptions.userData`
  opcional para mergear campos extras obrigatórios da collection `users`.
- **Seletores customizáveis**: `BaseCollectionPage` aceita
  `CollectionActionSelectors` opcionais no construtor para sobrescrever
  localizadores padrão.