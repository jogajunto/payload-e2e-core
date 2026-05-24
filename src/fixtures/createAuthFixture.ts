import type { Page, TestType } from "@playwright/test";
import { test as baseTest, expect } from "@playwright/test";
import type { BasePayload } from "payload";
import { getPayload } from "payload";

/**
 * Opções para customizar o comportamento da factory de fixtures.
 */
export type CreateAuthFixtureOptions = {
  /**
   * Dados extras para mergear no objeto de criação do usuário.
   * Útil quando a collection `users` do projeto possui campos
   * obrigatórios adicionais como `name`, `role`, etc.
   *
   * @example
   * ```ts
   * createAuthFixture(configPromise, {
   *   userData: { name: "Test User", role: "editor" },
   * })
   * ```
   */
  userData?: Record<string, unknown>;
};

/**
 * Tipo que define as fixtures expostas pelo pacote.
 *
 * - `payload`: Instância da API Local do Payload, disponível por worker.
 * - `authenticatedPage`: Página Playwright já autenticada como um usuário
 *   temporário, disponível por teste.
 */
export type AuthFixtures = {
  payload: BasePayload;
  authenticatedPage: Page;
};

/**
 * Cria um objeto `test` do Playwright estendido com as fixtures
 * `payload` (worker) e `authenticatedPage` (teste).
 *
 * A factory recebe a `configPromise` do Payload para que ela seja
 * injetada por cada projeto consumidor, permitindo que o pacote
 * permaneça genérico.
 *
 * ### Fixture `payload` (worker – escopo único por worker)
 * - Garante que as variáveis de ambiente `PAYLOAD_SECRET` e
 *   `DATABASE_URL` estejam definidas.
 * - Inicializa o Payload com a config fornecida.
 * - É destruída automaticamente ao final do worker.
 *
 * ### Fixture `authenticatedPage` (teste – um usuário por teste)
 * - Gera email/senha dinâmicos com `Date.now()`.
 * - Cria um usuário via API Local (`collection: "users"`) mergeando
 *   os `userData` opcionais fornecidos.
 * - Realiza login pela UI (`/admin/login`).
 * - Disponibiliza a página autenticada para o teste.
 * - No teardown: faz logout e deleta o usuário via API.
 *
 * @param configPromise  Promise da config do Payload exportada pelo
 *                       projeto consumidor (ex.: `import configPromise
 *                       from "@payload-config"`).
 * @param options        Opções opcionais para customizar a criação
 *                       do usuário (ex.: `userData` para campos extras).
 *
 * @returns Objeto `test` tipado com as fixtures `payload` e
 *          `authenticatedPage`.
 *
 * @example
 * ```ts
 * // tests/e2e/fixtures.ts
 * import configPromise from "@payload-config";
 * import { createAuthFixture } from "@jogajunto/payload-e2e-core";
 *
 * // Sem campos extras
 * export const test = createAuthFixture(configPromise);
 * ```
 *
 * @example
 * ```ts
 * // Com campos obrigatórios adicionais na collection users
 * import configPromise from "@payload-config";
 * import { createAuthFixture } from "@jogajunto/payload-e2e-core";
 *
 * export const test = createAuthFixture(configPromise, {
 *   userData: { name: "Test User", role: "editor" },
 * });
 * ```
 */
export function createAuthFixture(
  configPromise: any,
  options?: CreateAuthFixtureOptions,
): TestType<AuthFixtures, { payload: BasePayload }> {
  const test = baseTest.extend<AuthFixtures, { payload: BasePayload }>({
    /**
     * Fixture de worker que inicializa a API Local do Payload.
     *
     * Setup:
     * 1. Define defaults para `PAYLOAD_SECRET` e `DATABASE_URL` caso
     *    não estejam no ambiente.
     * 2. Chama `getPayload({ config: configPromise })`.
     *
     * Teardown:
     * - Executa `payload.destroy()`.
     */
    payload: [
      async (
        _workerContext: Record<string, never>,
        use: (payload: BasePayload) => Promise<void>,
      ): Promise<void> => {
        if (!process.env.PAYLOAD_SECRET) {
          process.env.PAYLOAD_SECRET = "payload-e2e-core-secret";
        }
        if (!process.env.DATABASE_URL) {
          process.env.DATABASE_URL =
            "postgresql://payload:payload@localhost:5432/payload_e2e";
        }

        const payload: BasePayload = await getPayload({ config: configPromise });
        await use(payload);
        await payload.destroy();
      },
      { scope: "worker" },
    ] as any,

    /**
     * Fixture de teste que fornece uma página já autenticada.
     *
     * Setup:
     * 1. Gera credenciais únicas.
     * 2. Cria o usuário via API Local com `email`, `password` e
     *    `options.userData` adicionais (se fornecidos).
     * 3. Navega para `/admin/login` e preenche o formulário.
     * 4. Aguarda a URL confirmar o login (`/admin`).
     *
     * Teardown:
     * 1. Faz logout via UI.
     * 2. Deleta o usuário via API Local.
     */
    authenticatedPage: [
      async (
        { payload, page }: { payload: BasePayload; page: Page },
        use: (page: Page) => Promise<void>,
      ) => {
        const testEmail = `test-user-${Date.now()}@example.com`;
        const testPassword = "test-password-123";

        // ── Setup: criar usuário via API ──────────────────────────────
        const newUser = await payload.create({
          collection: "users",
          data: {
            email: testEmail,
            password: testPassword,
            ...(options?.userData ?? {}),
          },
        });
        expect(newUser).toBeDefined();
        expect(newUser.email).toBe(testEmail);

        // ── Setup: login via UI ───────────────────────────────────────
        await page.goto("/admin/login");
        await page.waitForSelector('input[name="email"]');
        await page.fill('input[name="email"]', testEmail);
        await page.fill('input[name="password"]', testPassword);
        await page.click('button[type="submit"]');
        await page.waitForURL("/admin");

        // ── Disponibilizar a página autenticada para o teste ──────────
        await use(page);

        // ── Teardown: logout via UI ───────────────────────────────────
        // O label do botão do menu pode variar conforme o idioma.
        const navToggle = page
          .getByLabel("Abrir Cardápio")
          .filter({ visible: true });
        if (await navToggle.isVisible()) {
          await navToggle.click();
        }
        const logoutLink = page.locator('a[aria-label="Log out"]');
        if (await logoutLink.isVisible()) {
          await logoutLink.click();
          await page.waitForURL("/admin/login");
        }

        // ── Teardown: deletar usuário via API ─────────────────────────
        const { docs: users } = await payload.find({
          collection: "users",
          where: {
            email: { equals: testEmail },
          },
        });
        if (users.length > 0) {
          await payload.delete({
            collection: "users",
            id: users[0].id,
          });
        }
      },
      { scope: "test" },
    ] as any,
  });

  return test;
}