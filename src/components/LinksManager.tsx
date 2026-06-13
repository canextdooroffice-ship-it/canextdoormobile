import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Plus, Search, ExternalLink, Edit2, Trash2, Check, X, Link as LinkIcon, BookOpen, Clock, Tag } from 'lucide-react';

interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: string;
  notes?: string;
  createdAt: string;
}

interface LinksManagerProps {
  onBack: () => void;
}

const DEFAULT_CATEGORIES = ['Lectures', 'Reference', 'Revision Notes', 'Other'];

export const LinksManager: React.FC<LinksManagerProps> = ({ onBack }) => {
  // Load initial links from localStorage
  const [links, setLinks] = useState<LinkItem[]>(() => {
    try {
      const raw = localStorage.getItem('cand_links_manager_links');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('All');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [notes, setNotes] = useState('');

  // UI state for inline deletion confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('cand_links_manager_links', JSON.stringify(links));
  }, [links]);

  // Handle opening form for adding
  const handleOpenAdd = () => {
    setEditingLink(null);
    setTitle('');
    setUrl('');
    setCategory(DEFAULT_CATEGORIES[0]);
    setIsCustomCategory(false);
    setCustomCategory('');
    setNotes('');
    setIsFormOpen(true);
  };

  // Handle opening form for editing
  const handleOpenEdit = (link: LinkItem) => {
    setEditingLink(link);
    setTitle(link.title);
    setUrl(link.url);
    if (DEFAULT_CATEGORIES.includes(link.category)) {
      setCategory(link.category);
      setIsCustomCategory(false);
    } else {
      setCategory('Custom');
      setIsCustomCategory(true);
      setCustomCategory(link.category);
    }
    setNotes(link.notes || '');
    setIsFormOpen(true);
  };

  // Process & validate URL
  const formatUrl = (inputUrl: string): string => {
    let cleaned = inputUrl.trim();
    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = 'https://' + cleaned;
    }
    return cleaned;
  };

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !url.trim()) return;

    const finalUrl = formatUrl(url);
    const finalCategory = isCustomCategory ? (customCategory.trim() || 'Other') : category;

    if (editingLink) {
      // Update link
      setLinks(prev => prev.map(item => 
        item.id === editingLink.id 
          ? { ...item, title: title.trim(), url: finalUrl, category: finalCategory, notes: notes.trim() }
          : item
      ));
    } else {
      // Add new link
      const newLink: LinkItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        title: title.trim(),
        url: finalUrl,
        category: finalCategory,
        notes: notes.trim(),
        createdAt: new Date().toISOString()
      };
      setLinks(prev => [newLink, ...prev]);
    }

    setIsFormOpen(false);
  };

  // Delete Link
  const handleDelete = (id: string) => {
    setLinks(prev => prev.filter(item => item.id !== id));
    setDeletingId(null);
  };

  // Open link in new tab
  const handleOpenLink = (linkUrl: string) => {
    window.open(linkUrl, '_blank', 'noopener,noreferrer');
  };

  // Extract Domain for cleaner display
  const getDomainName = (urlString: string): string => {
    try {
      const parsed = new URL(urlString);
      return parsed.hostname.replace('www.', '');
    } catch {
      return 'web link';
    }
  };

  // Get dynamic categories list based on existing links
  const categoriesList = React.useMemo(() => {
    const categoriesSet = new Set(DEFAULT_CATEGORIES);
    links.forEach(link => {
      if (link.category) categoriesSet.add(link.category);
    });
    return Array.from(categoriesSet);
  }, [links]);

  // Filter and search logic
  const filteredLinks = React.useMemo(() => {
    return links.filter(link => {
      const matchesSearch = 
        link.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        link.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (link.notes && link.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = 
        selectedCategoryTab === 'All' || 
        link.category === selectedCategoryTab;

      return matchesSearch && matchesCategory;
    });
  }, [links, searchQuery, selectedCategoryTab]);

  return (
    <div className="links-manager-container fade-in">
      {/* Header */}
      <div className="links-header-bar">
        <button 
          type="button" 
          className="links-back-btn" 
          onClick={onBack}
          aria-label="Back to Tools"
        >
          <ArrowLeft size={16} />
          <span>Tools</span>
        </button>
        <h2 className="links-header-title">Links Manager</h2>
        <button 
          type="button" 
          className="links-add-nav-btn"
          onClick={handleOpenAdd}
        >
          <Plus size={16} />
          <span>Add Link</span>
        </button>
      </div>

      {/* Intro info card */}
      <div className="links-intro-card">
        <p className="links-intro-text">
          Save lecture URLs, study folders, or portal resources to open them with a single click.
        </p>
      </div>

      {/* Main Panel */}
      <div className="links-main-panel">
        
        {/* Search and Filters */}
        <div className="links-toolbar">
          <div className="links-search-wrapper">
            <Search size={16} className="links-search-icon" />
            <input 
              type="text" 
              placeholder="Search links..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="links-search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="links-search-clear"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter categories tabs horizontal scroll */}
          <div className="links-filter-scroll">
            <button 
              type="button"
              className={`links-filter-tab ${selectedCategoryTab === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedCategoryTab('All')}
            >
              All
            </button>
            {categoriesList.map(cat => (
              <button 
                key={cat}
                type="button"
                className={`links-filter-tab ${selectedCategoryTab === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategoryTab(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Links Grid / List */}
        <div className="links-list-wrapper">
          {filteredLinks.length === 0 ? (
            <div className="links-empty-state">
              <LinkIcon size={36} className="links-empty-icon" />
              <h4>No links found</h4>
              <p>
                {searchQuery || selectedCategoryTab !== 'All' 
                  ? 'No links match your search filters.' 
                  : 'Start by saving your first study web link.'}
              </p>
              {!searchQuery && selectedCategoryTab === 'All' && (
                <button 
                  type="button" 
                  className="links-add-empty-btn"
                  onClick={handleOpenAdd}
                >
                  + Add Link
                </button>
              )}
            </div>
          ) : (
            <div className="links-grid">
              {filteredLinks.map(link => {
                const isDeleting = deletingId === link.id;
                return (
                  <div key={link.id} className="link-item-card fade-in">
                    {isDeleting ? (
                      <div className="link-card-confirm-delete">
                        <p className="delete-confirm-title">Delete this link?</p>
                        <p className="delete-confirm-sub">{link.title}</p>
                        <div className="delete-confirm-actions">
                          <button 
                            type="button" 
                            className="delete-confirm-btn yes"
                            onClick={() => handleDelete(link.id)}
                          >
                            <Check size={14} /> Yes
                          </button>
                          <button 
                            type="button" 
                            className="delete-confirm-btn cancel"
                            onClick={() => setDeletingId(null)}
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="link-card-header">
                          <span className="link-card-category-badge">
                            <Tag size={10} className="tag-icon" />
                            {link.category}
                          </span>
                          <div className="link-card-actions">
                            <button 
                              type="button" 
                              className="link-action-icon-btn edit"
                              onClick={() => handleOpenEdit(link)}
                              title="Edit Link"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button 
                              type="button" 
                              className="link-action-icon-btn delete"
                              onClick={() => setDeletingId(link.id)}
                              title="Delete Link"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="link-card-body">
                          <h4 className="link-title">{link.title}</h4>
                          <span className="link-domain-badge">
                            <ExternalLink size={10} className="ext-icon" />
                            {getDomainName(link.url)}
                          </span>
                          {link.notes && <p className="link-notes-snippet">{link.notes}</p>}
                        </div>

                        <button 
                          type="button" 
                          className="link-card-open-btn"
                          onClick={() => handleOpenLink(link.url)}
                        >
                          <ExternalLink size={12} />
                          <span>Open Link</span>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal Drawer */}
      {isFormOpen && createPortal(
        <div className="links-modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="links-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="links-modal-header">
              <h3>{editingLink ? 'Edit Saved Link' : 'Save New Link'}</h3>
              <button 
                type="button" 
                className="links-modal-close-btn"
                onClick={() => setIsFormOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="links-form">
              <div className="form-group">
                <label className="styled-form-label">Link Title</label>
                <input 
                  type="text" 
                  placeholder="e.g., FR Lecture 1, Syllabus PDF, Study Drive" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="styled-form-input"
                  maxLength={60}
                  required
                />
              </div>

              <div className="form-group">
                <label className="styled-form-label">URL / Web Link</label>
                <input 
                  type="text" 
                  placeholder="e.g., youtube.com/watch?v=..., drive.google.com" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="styled-form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="styled-form-label">Category</label>
                <div className="category-selection-row">
                  <select 
                    value={isCustomCategory ? 'Custom' : category}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Custom') {
                        setIsCustomCategory(true);
                      } else {
                        setIsCustomCategory(false);
                        setCategory(val);
                      }
                    }}
                    className="styled-form-select"
                  >
                    {DEFAULT_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Custom">+ Create Custom Category</option>
                  </select>
                </div>
              </div>

              {isCustomCategory && (
                <div className="form-group fade-in">
                  <label className="styled-form-label">Custom Category Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Google Drive, ICAI, Handouts" 
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="styled-form-input"
                    maxLength={20}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="styled-form-label">Notes (Optional)</label>
                <textarea 
                  placeholder="Add a small description, access code, password, or task details..." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="styled-form-textarea"
                  maxLength={160}
                  rows={3}
                />
              </div>

              <div className="form-actions-row">
                <button type="submit" className="form-submit-btn">
                  {editingLink ? 'Save Changes' : 'Save Link'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="form-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
