import type { Locator, Page } from "@playwright/test";

/**
 * Tipo que define os seletores customizados para ações do Payload CMS.
 * Permite que collections específicas sobrescrevam os seletores padrão.
 */
export interface CollectionActionSelectors {
  saveButton?: string;
  deleteButton?: string;
  confirmDeleteButton?: string;
  moreActionsButton?: string;
}

/**
 * Classe base abstrata para modelar páginas de collection do Payload CMS.
 *
 * Fornece navegação, criação, salvamento, exclusão e verificação em listagem,
 * além de troca de abas. Deve ser estendida por páginas específicas
 * (ex.: `PostsPage`, `UsersPage`) que adicionam campos e operações particulares.
 *
 * @example
 * ```ts
 * class PostsPage extends BaseCollectionPage {
 *   constructor(page: Page) {
 *     super(page, "posts");
 *   }
 *
 *   async fillTitle(title: string) {
 *     await this.page.getByLabel("Título").fill(title);
 *   }
 * }
 * ```
 */
export abstract class BaseCollectionPage {
  /** Instância da página Playwright. */
  protected readonly page: Page;

  /** Slug da collection no Payload (ex.: "posts", "users"). */
  protected readonly collectionSlug: string;

  // ---------------------------------------------------------------------------
  // Locators padrão – podem ser sobrescritos via `customSelectors` no construtor
  // ---------------------------------------------------------------------------

  /** Botão de salvar ("Salvar" / "Save"). */
  protected saveButton: Locator;

  /** Toast de operação bem-sucedida (contém "com sucesso"). */
  protected toastSuccess: Locator;

  /** Botão que abre o menu de "Mais ações". */
  protected moreActionsButton: Locator;

  /** Botão de deletar dentro do menu de ações. */
  protected deleteButton: Locator;

  /** Botão de confirmação de exclusão no modal. */
  protected confirmDeleteButton: Locator;

  /**
   * @param page            Instância da página Playwright.
   * @param collectionSlug  Slug da collection (ex.: "posts").
   * @param customSelectors Seletores customizados para sobrescrever os padrões.
   */
  constructor(
    page: Page,
    collectionSlug: string,
    customSelectors?: CollectionActionSelectors,
  ) {
    this.page = page;
    this.collectionSlug = collectionSlug;

    this.saveButton = page.locator(customSelectors?.saveButton ?? "button#action-save");
    this.toastSuccess = page.getByText("com sucesso", { exact: false });
    this.moreActionsButton = page.locator(
      customSelectors?.moreActionsButton ?? "button.popup-button.popup-button--default",
    );
    this.deleteButton = page.locator(customSelectors?.deleteButton ?? "button#action-delete");
    this.confirmDeleteButton = page.locator(
      customSelectors?.confirmDeleteButton ?? "button#confirm-action",
    );
  }

  // ---------------------------------------------------------------------------
  // Navegação
  // ---------------------------------------------------------------------------

  /**
   * Navega para a página de listagem da collection.
   *
   * @example
   * ```ts
   * await postsPage.gotoList(); // → /admin/collections/posts
   * ```
   */
  async gotoList(): Promise<void> {
    await this.page.goto(`/admin/collections/${this.collectionSlug}`);
  }

  /**
   * Navega para a página de criação de um novo registro na collection
   * e aguarda até que a URL corresponda a `/admin/collections/:slug/create`
   * ou ao redirecionamento para `/admin/collections/:slug/:id` (comum quando
   * a collection possui "versions" habilitado no Payload).
   */
  async gotoCreate(): Promise<void> {
    await this.page.goto(`/admin/collections/${this.collectionSlug}/create`);
    await this.page.waitForURL(
      new RegExp(`/admin/collections/${this.collectionSlug}/(create|[a-zA-Z0-9_-]+$)`),
    );
  }

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  /**
   * Clica no botão de salvar e aguarda o toast de sucesso aparecer.
   *
   * @param timeout  Tempo máximo (ms) para aguardar o toast. Padrão: 15000.
   */
  async save(timeout = 15000): Promise<void> {
    await this.saveButton.click();
    await this.toastSuccess.waitFor({ state: "visible", timeout });
  }

  /**
   * Executa o fluxo completo de exclusão:
   * 1. Abre o menu "Mais ações".
   * 2. Clica em "Deletar".
   * 3. Confirma no modal.
   * 4. Aguarda a URL retornar para a página de listagem.
   *
   * @param timeout  Tempo máximo (ms) para cada etapa. Padrão: 15000.
   */
  async delete(timeout = 15000): Promise<void> {
    await this.moreActionsButton.click();
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
    await this.toastSuccess.waitFor({ state: "visible", timeout });
    await this.page.waitForURL(`**/admin/collections/${this.collectionSlug}`);
  }

  // ---------------------------------------------------------------------------
  // Verificações em listagem
  // ---------------------------------------------------------------------------

  /**
   * Verifica se o texto exato informado está visível na listagem da collection.
   *
   * @param title  Texto a ser localizado na listagem.
   */
  async verifyInList(title: string): Promise<void> {
    await this.page.locator(`text="${title}"`).first().waitFor({ state: "visible" });
  }

  /**
   * Verifica se o texto exato informado **não** está visível na listagem.
   *
   * @param title  Texto que deve estar ausente da listagem.
   */
  async verifyNotInList(title: string): Promise<void> {
    await this.page.locator(`text="${title}"`).first().waitFor({ state: "hidden" });
  }

  // ---------------------------------------------------------------------------
  // Abas
  // ---------------------------------------------------------------------------

  /**
   * Alterna para uma aba específica da collection (ex.: "SEO", "Conteúdo").
   *
   * @param tabName Nome visível da aba (case‑sensitive).
   * @param exact   Se `true` (padrão), usa correspondência exata do nome.
   *                Passe `false` para correspondência parcial (ex.: "Conteúdo"
   *                casa com "Conteúdo Principal").
   */
  async switchTab(tabName: string, exact = true): Promise<void> {
    await this.page
      .getByRole("button", { name: tabName, exact })
      .filter({ visible: true })
      .click();
  }
}