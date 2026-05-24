# @agenciajogajunto/payload-e2e-core

Abstrações reutilizáveis de teste E2E (Playwright) para o **Payload CMS**.

## Problema

Projetos que utilizam Payload CMS repetem o mesmo boilerplate de teste E2E:
inicialização do Payload, criação/deleção de usuários, login via UI, navegação
para collections, salvamento e exclusão de registros. Este pacote centraliza
essas operações em uma arquitetura extensível baseada em **Page Object Model**
e **Fixtures injetáveis**.

## Instalação

```bash
npm install --save-dev @agenciajogajunto/payload-e2e-core
```

Certifique-se de que as peer dependencies estão instaladas no projeto:

```bash
npm install --save-dev @playwright/test payload
```

## Uso

### 1. Criar um arquivo de fixtures

Crie um arquivo compartilhado que exporta o `test` estendido com as fixtures
de autenticação. A `configPromise` do Payload é injetada aqui, permitindo que
o pacote funcione em qualquer projeto.

```ts
// tests/e2e/fixtures.ts
import configPromise from "@payload-config";
import { createAuthFixture } from "@agenciajogajunto/payload-e2e-core";

// Caso a collection `users` do projeto não tenha campos obrigatórios extras
export const test = createAuthFixture(configPromise);
export { expect } from "@playwright/test";
```

Se a collection `users` do seu projeto possui campos obrigatórios
adicionais (ex.: `name`, `role`), passe-os no segundo parâmetro:

```ts
// tests/e2e/fixtures.ts
import configPromise from "@payload-config";
import { createAuthFixture } from "@agenciajogajunto/payload-e2e-core";

export const test = createAuthFixture(configPromise, {
  userData: { name: "Test User", role: "editor" },
});
export { expect } from "@playwright/test";
```

### 2. Criar uma Page Object específica

Estenda a `BaseCollectionPage` para adicionar campos e operações da sua
collection.

```ts
// tests/e2e/pages/PratosPage.ts
import { BaseCollectionPage } from "@agenciajogajunto/payload-e2e-core";
import type { Page } from "@playwright/test";

export class PratosPage extends BaseCollectionPage {
  constructor(page: Page) {
    super(page, "pratos");
  }

  async fillNome(nome: string) {
    await this.page.getByLabel("Nome").fill(nome);
  }

  async fillDescricao(descricao: string) {
    const editor = this.page.locator('div[data-lexical-editor="true"]');
    await editor.click();
    await editor.pressSequentially(descricao);
  }

  async selectCategoria(categoria: string) {
    await this.page.getByLabel("Categoria").selectOption(categoria);
  }
}
```

### 3. Escrever um teste E2E

```ts
// tests/e2e/pratos.spec.ts
import { test, expect } from "./fixtures";
import { PratosPage } from "./pages/PratosPage";

test.describe("CRUD de Pratos", () => {
  test("deve criar, ler, atualizar e deletar um prato", async ({
    authenticatedPage,
  }) => {
    const pratosPage = new PratosPage(authenticatedPage);
    const nomePrato = `Prato Teste - ${Date.now()}`;
    const nomeAtualizado = `Prato Atualizado - ${Date.now()}`;

    // ── CREATE ──────────────────────────────────────────────────────
    await pratosPage.gotoCreate();
    await pratosPage.fillNome(nomePrato);
    await pratosPage.fillDescricao("Descrição do prato teste.");
    await pratosPage.save();
    await pratosPage.verifyInList(nomePrato);

    // ── READ ────────────────────────────────────────────────────────
    await pratosPage.gotoList();
    await pratosPage.verifyInList(nomePrato);

    // ── UPDATE ──────────────────────────────────────────────────────
    // Abre o registro para edição
    await pratosPage.gotoList();
    await authenticatedPage.locator(`text="${nomePrato}"`).click();
    await pratosPage.fillNome(nomeAtualizado);
    await pratosPage.save();

    // ── DELETE ──────────────────────────────────────────────────────
    await pratosPage.gotoList();
    await authenticatedPage.locator(`text="${nomeAtualizado}"`).click();
    await pratosPage.delete();

    // Verifica que foi removido da listagem
    await pratosPage.verifyNotInList(nomeAtualizado);
  });
});
```

### 4. Configurar o `playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 80000,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/admin",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
});
```

## API

### `BaseCollectionPage`

| Método                     | Descrição                                          |
|----------------------------|----------------------------------------------------|
| `gotoList()`               | Navega para a listagem da collection.              |
| `gotoCreate()`             | Navega para a página de criação.                   |
| `save()`                   | Salva e aguarda toast de sucesso.                  |
| `delete()`                 | Executa fluxo completo de exclusão.                |
| `verifyInList(title)`      | Verifica se o texto está visível na listagem.      |
| `verifyNotInList(title)`   | Verifica se o texto NÃO está na listagem.          |
| `switchTab(tabName)`       | Alterna para uma aba (ex.: "SEO", "Conteúdo").     |

### `createAuthFixture(configPromise, options?)`

| Parâmetro          | Tipo                       | Obrigatório | Descrição                                    |
|--------------------|----------------------------|-------------|----------------------------------------------|
| `configPromise`    | `any`                      | sim         | `configPromise` do Payload (`@payload-config`). |
| `options.userData` | `Record<string, unknown>`  | não         | Dados extras para mergear na criação do usuário. |

| Fixture            | Escopo   | Descrição                                  |
|--------------------|----------|--------------------------------------------|
| `payload`          | worker   | Instância da API Local do Payload.         |
| `authenticatedPage`| test     | Página Playwright já autenticada.          |

## Estrutura do Projeto

```
src/
├── index.ts                        # Entrypoint
├── pages/
│   └── BaseCollectionPage.ts       # Classe base abstrata
└── fixtures/
    └── createAuthFixture.ts        # Factory de fixtures
```