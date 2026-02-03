'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  Copy,
  Check,
  PanelRightClose,
  PanelRight,
  Trash2,
} from 'lucide-react'

export interface LiquidTag {
  category: string
  name: string
  tag: string
  description: string
  example: string
}

interface SnippetBuilderProps {
  tags: LiquidTag[]
  onCopy: (text: string, label: string) => void
  copiedText: string | null
}

const STARTER_TEMPLATE = `{% if response.success %}

{% endif %}`

const CATEGORY_ICONS: Record<string, string> = {
  'User Stats': '📊',
  'Game Info': '🎮',
  'Alerts': '⚠️',
  'Trending': '📈',
  'Lineup': '👥',
}

export default function SnippetBuilder({ tags, onCopy, copiedText }: SnippetBuilderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['User Stats'])
  const [snippetContent, setSnippetContent] = useState(STARTER_TEMPLATE)
  const [isBuilderVisible, setIsBuilderVisible] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load builder visibility from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('snippetBuilderVisible')
    if (saved !== null) {
      setIsBuilderVisible(JSON.parse(saved))
    }
  }, [])

  // Save builder visibility to localStorage
  useEffect(() => {
    localStorage.setItem('snippetBuilderVisible', JSON.stringify(isBuilderVisible))
  }, [isBuilderVisible])

  // Group tags by category
  const tagsByCategory = useMemo(() => {
    return tags.reduce<Record<string, LiquidTag[]>>((acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = []
      }
      acc[tag.category]!.push(tag)
      return acc
    }, {})
  }, [tags])

  // Filter tags based on search query
  const filteredTagsByCategory = useMemo(() => {
    if (!searchQuery.trim()) return tagsByCategory

    const query = searchQuery.toLowerCase()
    const filtered: Record<string, LiquidTag[]> = {}

    Object.entries(tagsByCategory).forEach(([category, categoryTags]) => {
      const matchingTags = categoryTags.filter(
        (tag) =>
          tag.name.toLowerCase().includes(query) ||
          tag.description.toLowerCase().includes(query)
      )
      if (matchingTags.length > 0) {
        filtered[category] = matchingTags
      }
    })

    return filtered
  }, [tagsByCategory, searchQuery])

  // Get all categories (for consistent ordering)
  const categories = useMemo(() => {
    return Object.keys(tagsByCategory)
  }, [tagsByCategory])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const addTagToSnippet = (tag: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent =
        snippetContent.substring(0, start) + tag + snippetContent.substring(end)
      setSnippetContent(newContent)

      // Set cursor position after the inserted tag
      setTimeout(() => {
        textarea.focus()
        textarea.selectionStart = textarea.selectionEnd = start + tag.length
      }, 0)
    } else {
      // Fallback: append to content
      setSnippetContent((prev) => prev + tag)
    }
  }

  const handleClear = () => {
    if (window.confirm('Reset snippet to starter template? Your current content will be lost.')) {
      setSnippetContent(STARTER_TEMPLATE)
    }
  }

  const handleCopyAll = () => {
    onCopy(snippetContent, 'snippet')
  }

  const hasSearchResults = Object.keys(filteredTagsByCategory).length > 0

  return (
    <div className="border-t border-gray-200">
      {/* Step 2 Header */}
      <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Step 2: Build your snippet
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Browse tags and build your personalized email content
            </p>
          </div>
          <button
            onClick={() => setIsBuilderVisible(!isBuilderVisible)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isBuilderVisible ? (
              <>
                <PanelRightClose className="w-4 h-4" />
                Hide Builder
              </>
            ) : (
              <>
                <PanelRight className="w-4 h-4" />
                Show Builder
              </>
            )}
          </button>
        </div>
      </div>

      {isBuilderVisible && (
        <div className="flex flex-col lg:flex-row min-h-[500px]">
          {/* Left Panel - Tag Browser */}
          <div className="w-full lg:w-1/2 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 overflow-y-auto max-h-[500px]">
            {/* Search Input */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow bg-white"
              />
            </div>

            {/* Category Accordions */}
            {!hasSearchResults && searchQuery && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No tags matching &quot;{searchQuery}&quot;
              </div>
            )}

            <div className="space-y-2">
              {categories.map((category) => {
                const categoryTags = filteredTagsByCategory[category]
                if (!categoryTags || categoryTags.length === 0) return null

                const isExpanded = expandedCategories.includes(category) || !!searchQuery
                const icon = CATEGORY_ICONS[category] || '📋'

                return (
                  <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="font-medium text-gray-900 text-sm">{category}</span>
                        <span className="text-xs text-gray-400">({categoryTags.length})</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {/* Tag Cards */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {categoryTags.map((tag) => (
                          <div
                            key={tag.tag}
                            className="px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-sm">
                                  {tag.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {tag.description}
                                </div>
                                <div className="text-xs text-gray-400 italic mt-1">
                                  Example: {tag.example}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => addTagToSnippet(tag.tag)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Add to snippet"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => onCopy(tag.tag, tag.tag)}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                                  title="Copy tag"
                                >
                                  {copiedText === tag.tag ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Panel - Snippet Editor */}
          <div className="w-full lg:w-1/2 flex flex-col bg-white">
            {/* Editor Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Your Snippet
              </h4>
            </div>

            {/* Textarea */}
            <div className="flex-1 p-4">
              <textarea
                ref={textareaRef}
                value={snippetContent}
                onChange={(e) => setSnippetContent(e.target.value)}
                className="w-full h-full min-h-[350px] p-4 font-mono text-sm bg-gray-900 text-green-400 rounded-lg border-0 resize-none focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder="Your Liquid snippet will appear here..."
                spellCheck={false}
              />
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50/50">
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
              <button
                onClick={handleCopyAll}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
              >
                {copiedText === 'snippet' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
