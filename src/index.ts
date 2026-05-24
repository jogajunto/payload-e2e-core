/**
 * @jogajunto/payload-e2e-core
 *
 * Entrypoint do pacote. Exporta as abstrações principais para testes
 * E2E com Playwright + Payload CMS.
 */

export { BaseCollectionPage } from "./pages/BaseCollectionPage";
export type { CollectionActionSelectors } from "./pages/BaseCollectionPage";

export { createAuthFixture } from "./fixtures/createAuthFixture";
export type { AuthFixtures } from "./fixtures/createAuthFixture";