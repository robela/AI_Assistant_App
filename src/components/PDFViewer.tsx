import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface PDFViewerProps {
  visible: boolean;
  onClose: () => void;
  documentId: number | string;
  documentName: string;
  pageNumber?: number;
  backendUrl: string;
  token: string;
}

export function PDFViewer({
  visible,
  onClose,
  documentId,
  documentName,
  pageNumber = 1,
  backendUrl,
  token,
}: PDFViewerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  // Reset and fetch when modal opens
  useEffect(() => {
    if (visible && !hasLoaded.current) {
      hasLoaded.current = true;
      fetchPDF();
    }
    if (!visible) {
      hasLoaded.current = false;
      setPdfUri(null);
      setError(null);
    }
  }, [visible]);

  const fetchPDF = async () => {
    if (!backendUrl || !token) {
      setError('Authentication failed. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const encodedFileName = encodeURIComponent(documentName);
      const endpoints = [
        `${backendUrl}/api/document/${documentId}/pdf`,
        `${backendUrl}/document/${documentId}/pdf`,
        `${backendUrl}/api/documents/${documentId}/download`,
        `${backendUrl}/documents/${documentId}/download`,
        `${backendUrl}/api/document/${encodedFileName}/pdf`,
        `${backendUrl}/document/${encodedFileName}/pdf`,
      ];

      let successfulEndpoint: string | null = null;
      let lastError = '';

      for (const endpoint of endpoints) {
        try {
          console.log('Trying endpoint:', endpoint);
          const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/pdf',
            },
          });
          if (res.ok) {
            successfulEndpoint = endpoint;
            console.log('✅ Success with endpoint:', endpoint);
            break;
          } else {
            lastError = `HTTP ${res.status} at ${endpoint}`;
            console.log('❌ Failed:', lastError);
          }
        } catch (err: any) {
          lastError = `${err.message} at ${endpoint}`;
          console.log('❌ Error:', lastError);
        }
      }

      if (!successfulEndpoint) {
        throw new Error(`All endpoint attempts failed. Last error: ${lastError}`);
      }

      // Download to local cache
      const fileName = `${documentName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      console.log('Downloading PDF to:', filePath);
      const downloadResult = await FileSystem.downloadAsync(successfulEndpoint, filePath, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf',
        },
      });

      console.log('PDF downloaded, status:', downloadResult.status);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      console.log('PDF saved, size:', (fileInfo as any).size, 'bytes');

      // Show PDF inline via WebView
      setPdfUri(downloadResult.uri);
    } catch (err: any) {
      console.error('PDF fetch error:', err);
      setError(err?.message || 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        setError(null);
        onClose();
      }}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              onClose();
            }}
            style={styles.closeBtn}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {documentName}
          </Text>
          <View style={styles.spacer} />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#A63D33" />
            <Text style={styles.loadingText}>Loading PDF...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContent}>
            <Feather name="alert-circle" size={48} color="#A63D33" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setError(null);
                hasLoaded.current = false;
                fetchPDF();
              }}
            >
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : pdfUri ? (
          <WebView
            source={{ uri: pdfUri }}
            style={styles.webview}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            injectedJavaScript={
              pageNumber > 1
                ? `
                    (function() {
                      var tryScroll = function(attempts) {
                        var pages = document.querySelectorAll('.page,[data-page-number]');
                        if (pages.length >= ${pageNumber}) {
                          pages[${pageNumber - 1}].scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else if (attempts > 0) {
                          setTimeout(function() { tryScroll(attempts - 1); }, 600);
                        }
                      };
                      setTimeout(function() { tryScroll(10); }, 800);
                    })();
                  `
                : ''
            }
            onError={(e) => {
              console.error('WebView error:', e.nativeEvent);
              setError('Failed to render PDF. Try reopening.');
              setPdfUri(null);
            }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF5F3',
  },
  header: {
    backgroundColor: '#A63D33',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  closeBtn: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  spacer: {
    width: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#3A1410',
    marginTop: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: '#A63D33',
    marginTop: 16,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#A63D33',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  webview: {
    flex: 1,
  },
});
