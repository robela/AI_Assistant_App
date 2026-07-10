import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { CitationChunk } from '../api';

interface CitationsProps {
  chunks?: Record<string, CitationChunk>;
  onDocumentPress?: (documentId: string, fileName: string, pageNumber?: number) => void;
}

export function Citations({ chunks, onDocumentPress }: CitationsProps) {
  if (!chunks || Object.keys(chunks).length === 0) {
    return null;
  }

  const citations = useMemo(() => {
    const citationsByDocument: Record<
      string,
      { fileName: string; documentId: string; pages: Set<number> }
    > = {};

    Object.values(chunks).forEach((chunk) => {
      const docId = chunk.document_id;
      if (!citationsByDocument[docId]) {
        citationsByDocument[docId] = {
          fileName: chunk.file_name,
          documentId: docId,
          pages: new Set(),
        };
      }
      citationsByDocument[docId].pages.add(chunk.page_num_within_doc);
    });

    return Object.values(citationsByDocument).map((doc) => ({
      fileName: doc.fileName,
      documentId: doc.documentId,
      pages: Array.from(doc.pages).sort((a, b) => a - b),
    }));
  }, [chunks]);

  if (citations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Source Documents:</Text>
      {citations.map((citation, index) => (
        <View key={index} style={styles.citationItem}>
          {onDocumentPress ? (
            <Pressable
              onPress={() =>
                onDocumentPress(citation.documentId, citation.fileName, citation.pages[0])
              }
              style={[styles.citationButton]}
            >
              <Text style={styles.citationButtonText} numberOfLines={1}>
                {citation.fileName}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.citationText}>{citation.fileName}</Text>
          )}

          <Text style={styles.pageInfo}>
            {citation.pages.length > 1 ? 'Pages: ' : 'Page: '}
            {citation.pages.map((page, pageIndex) => (
              <Text key={page}>
                {onDocumentPress ? (
                  <Pressable
                    onPress={() =>
                      onDocumentPress(
                        citation.documentId,
                        citation.fileName,
                        page
                      )
                    }
                  >
                    <Text style={styles.pageLink}>{page}</Text>
                  </Pressable>
                ) : (
                  <Text>{page}</Text>
                )}
                {pageIndex < citation.pages.length - 1 && ', '}
              </Text>
            ))}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A1410',
    marginBottom: 8,
  },
  citationItem: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F3C6C0',
    borderRadius: 8,
  },
  citationButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A63D33',
    marginBottom: 6,
  },
  citationButtonText: {
    fontSize: 13,
    color: '#A63D33',
    fontWeight: '500',
  },
  citationText: {
    fontSize: 13,
    color: '#3A1410',
    fontWeight: '500',
    marginBottom: 6,
  },
  pageInfo: {
    fontSize: 12,
    color: '#5C2018',
    lineHeight: 18,
  },
  pageLink: {
    color: '#0066CC',
    textDecorationLine: 'underline',
  },
});
