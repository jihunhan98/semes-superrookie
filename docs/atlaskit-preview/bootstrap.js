import { setBooleanFeatureFlagResolver } from '@atlaskit/platform-feature-flags';
// A standalone preview has no Atlassian product feature-gate client.
// Use the library's resolver API to keep optional product experiments disabled.
setBooleanFeatureFlagResolver(() => false);
import('./preview');
