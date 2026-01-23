/**
 * Unit tests for LanguageRegistry
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { LanguageRegistry } from '../../../packages/language-server/src/language-registry.js';
import type {
  LanguageContributionInterface,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';
import type { LangiumServices } from 'langium';

// Mock implementations for testing
function createMockContribution(
  languageId: string,
  fileExtensions: readonly string[]
): LanguageContributionInterface {
  return {
    languageId,
    fileExtensions,
    generatedSharedModule: {} as never,
    generatedModule: {} as never,
    manifest: {
      languageId,
      displayName: languageId.toUpperCase(),
      fileExtension: fileExtensions[0] ?? '.test',
      baseExtension: fileExtensions[0] ?? '.test',
      rootTypes: [{
        astType: 'Model',
        displayName: 'Model',
        fileSuffix: '',
        folder: 'models',
        icon: 'file',
        template: '',
      }],
      diagrammingEnabled: false,
    },
  };
}

function createMockServices(): LangiumServices {
  return {} as LangiumServices;
}

function createMockLspProviders(): Required<LspFeatureProviders> {
  return {} as Required<LspFeatureProviders>;
}

function createMockGlspProviders(): Required<GlspFeatureProviders> {
  return {} as Required<GlspFeatureProviders>;
}

describe('LanguageRegistry', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register', () => {
    it('should register a language contribution', () => {
      const contribution = createMockContribution('ecml', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      expect(registry.hasLanguage('ecml')).to.be.true;
      expect(registry.hasExtension('.ecml')).to.be.true;
      expect(registry.size).to.equal(1);
    });

    it('should register multiple file extensions', () => {
      const contribution = createMockContribution('story', ['.story', '.character']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      expect(registry.hasExtension('.story')).to.be.true;
      expect(registry.hasExtension('.character')).to.be.true;
    });

    it('should throw on duplicate language ID', () => {
      const contribution1 = createMockContribution('ecml', ['.ecml']);
      const contribution2 = createMockContribution('ecml', ['.ecm']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution1, services, lspProviders, glspProviders);

      expect(() =>
        registry.register(contribution2, services, lspProviders, glspProviders)
      ).to.throw(/Duplicate language ID/);
    });

    it('should throw on duplicate file extension', () => {
      const contribution1 = createMockContribution('ecml', ['.ecml']);
      const contribution2 = createMockContribution('other', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution1, services, lspProviders, glspProviders);

      expect(() =>
        registry.register(contribution2, services, lspProviders, glspProviders)
      ).to.throw(/already registered/);
    });
  });

  describe('getByLanguageId', () => {
    it('should return registered language by ID', () => {
      const contribution = createMockContribution('ecml', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      const result = registry.getByLanguageId('ecml');
      expect(result).to.not.be.undefined;
      expect(result?.contribution.languageId).to.equal('ecml');
    });

    it('should return undefined for unknown language ID', () => {
      const result = registry.getByLanguageId('unknown');
      expect(result).to.be.undefined;
    });
  });

  describe('getByExtension', () => {
    it('should return registered language by extension', () => {
      const contribution = createMockContribution('ecml', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      const result = registry.getByExtension('.ecml');
      expect(result).to.not.be.undefined;
      expect(result?.contribution.languageId).to.equal('ecml');
    });

    it('should normalize extension without leading dot', () => {
      const contribution = createMockContribution('ecml', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      const result = registry.getByExtension('ecml');
      expect(result).to.not.be.undefined;
    });

    it('should be case-insensitive', () => {
      const contribution = createMockContribution('ecml', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      expect(registry.getByExtension('.ECML')).to.not.be.undefined;
      expect(registry.getByExtension('.Ecml')).to.not.be.undefined;
    });

    it('should return undefined for unknown extension', () => {
      const result = registry.getByExtension('.unknown');
      expect(result).to.be.undefined;
    });
  });

  describe('getByUri', () => {
    it('should return registered language by URI', () => {
      const contribution = createMockContribution('ecml', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      const result = registry.getByUri('file:///path/to/model.ecml');
      expect(result).to.not.be.undefined;
      expect(result?.contribution.languageId).to.equal('ecml');
    });

    it('should handle compound extensions', () => {
      const contribution = createMockContribution('spdevkit', ['.task.spdk']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      const result = registry.getByUri('file:///path/to/my.task.spdk');
      expect(result).to.not.be.undefined;
      expect(result?.contribution.languageId).to.equal('spdevkit');
    });

    it('should return undefined for unknown extension in URI', () => {
      const result = registry.getByUri('file:///path/to/file.unknown');
      expect(result).to.be.undefined;
    });

    it('should return undefined for URI without extension', () => {
      const result = registry.getByUri('file:///path/to/noextension');
      expect(result).to.be.undefined;
    });
  });

  describe('getAllLanguageIds', () => {
    it('should return all registered language IDs', () => {
      const contribution1 = createMockContribution('ecml', ['.ecml']);
      const contribution2 = createMockContribution('spdevkit', ['.spdk']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution1, services, lspProviders, glspProviders);
      registry.register(contribution2, services, lspProviders, glspProviders);

      const ids = registry.getAllLanguageIds();
      expect(ids).to.have.length(2);
      expect(ids).to.include('ecml');
      expect(ids).to.include('spdevkit');
    });

    it('should return empty array when no languages registered', () => {
      const ids = registry.getAllLanguageIds();
      expect(ids).to.have.length(0);
    });
  });

  describe('getAllExtensions', () => {
    it('should return all registered extensions', () => {
      const contribution = createMockContribution('story', ['.story', '.character']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);

      const extensions = registry.getAllExtensions();
      expect(extensions).to.have.length(2);
      expect(extensions).to.include('.story');
      expect(extensions).to.include('.character');
    });
  });

  describe('clear', () => {
    it('should remove all registered languages', () => {
      const contribution = createMockContribution('ecml', ['.ecml']);
      const services = createMockServices();
      const lspProviders = createMockLspProviders();
      const glspProviders = createMockGlspProviders();

      registry.register(contribution, services, lspProviders, glspProviders);
      expect(registry.size).to.equal(1);

      registry.clear();
      expect(registry.size).to.equal(0);
      expect(registry.hasLanguage('ecml')).to.be.false;
      expect(registry.hasExtension('.ecml')).to.be.false;
    });
  });

  describe('sharedServices', () => {
    it('should throw when accessing before initialization', () => {
      expect(() => registry.sharedServices).to.throw(/not initialized/);
    });

    it('should throw when initializing twice', () => {
      const sharedServices = {} as never;
      registry.setSharedServices(sharedServices);

      expect(() => registry.setSharedServices(sharedServices)).to.throw(/already initialized/);
    });

    it('should return shared services after initialization', () => {
      const sharedServices = { test: 'value' } as never;
      registry.setSharedServices(sharedServices);

      expect(registry.sharedServices).to.deep.equal(sharedServices);
    });
  });
});
