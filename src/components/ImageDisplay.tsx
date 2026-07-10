import React, { useState, useRef } from 'react';
import {
  Image,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Text,
  ScrollView,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ChatImage } from '../api';

interface ImageDisplayProps {
  image: ChatImage;
  allImages?: ChatImage[];
  isUserImage?: boolean;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.25;

export function ImageDisplay({ image, allImages, isUserImage = false }: ImageDisplayProps) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const swipeStartX = useRef(0);
  const isSwiping = useRef(false);

  const images = allImages && allImages.length > 0 ? allImages : [image];
  const initialIndex = images.findIndex(i => i.image_id === image.image_id);

  const openModal = () => setModalIndex(initialIndex >= 0 ? initialIndex : 0);
  const closeModal = () => setModalIndex(null);

  const go = (delta: number) => {
    setModalIndex(prev => {
      if (prev === null) return prev;
      return Math.max(0, Math.min(images.length - 1, prev + delta));
    });
  };

  // Swipe left = next, swipe right = prev
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => images.length > 1,
      onMoveShouldSetPanResponder: (_, g) => images.length > 1 && Math.abs(g.dx) > 8,
      onPanResponderGrant: (e) => {
        swipeStartX.current = e.nativeEvent.pageX;
        isSwiping.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 8) isSwiping.current = true;
      },
      onPanResponderRelease: (_, g) => {
        if (!isSwiping.current) return;
        if (g.dx < -SWIPE_THRESHOLD) go(1);
        else if (g.dx > SWIPE_THRESHOLD) go(-1);
      },
    }),
  ).current;

  const current = modalIndex !== null ? images[modalIndex] : null;

  return (
    <>
      <TouchableOpacity onPress={openModal} activeOpacity={0.85}>
        <View style={styles.container}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${image.image_data}` }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          <View style={styles.expandHint}>
            <Feather name="maximize-2" size={13} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>

      <Modal visible={modalIndex !== null} transparent animationType="fade" onRequestClose={closeModal}>
        <SafeAreaView style={styles.overlay}>

          {/* ── Header ── */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {current?.caption ? current.caption.slice(0, 40) : 'Image'}
            </Text>
            {images.length > 1 && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{(modalIndex ?? 0) + 1}/{images.length}</Text>
              </View>
            )}
          </View>

          {/* ── Zoomable + swipeable image area ── */}
          <View style={styles.imageArea} {...panResponder.panHandlers}>
            {current && (
              <ScrollView
                style={styles.imageScroll}
                contentContainerStyle={styles.imageScrollContent}
                maximumZoomScale={4}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                centerContent
                bouncesZoom={Platform.OS === 'ios'}
              >
                <Image
                  source={{ uri: `data:image/jpeg;base64,${current.image_data}` }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </ScrollView>
            )}

            {/* Swipe hint arrows — only when multiple images */}
            {images.length > 1 && (
              <>
                {(modalIndex ?? 0) > 0 && (
                  <TouchableOpacity style={[styles.swipeArrow, styles.swipeArrowLeft]} onPress={() => go(-1)}>
                    <Feather name="chevron-left" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
                {(modalIndex ?? 0) < images.length - 1 && (
                  <TouchableOpacity style={[styles.swipeArrow, styles.swipeArrowRight]} onPress={() => go(1)}>
                    <Feather name="chevron-right" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* ── Caption ── */}
          {current?.caption ? (
            <View style={styles.captionBox}>
              <ScrollView style={{ maxHeight: SCREEN_H * 0.14 }}>
                <Text style={styles.captionText}>{current.caption}</Text>
              </ScrollView>
            </View>
          ) : null}

          {/* ── Dot indicators ── */}
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setModalIndex(i)}>
                  <View style={[styles.dot, i === modalIndex && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}

        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ── Thumbnail ──────────────────────────────────────────
  container: {
    marginTop: 12,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F3C6C0',
  },
  expandHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#A63D33',
    borderRadius: 4,
    padding: 4,
  },
  // ── Modal ──────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: '#3A1410',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A63D33',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  counterBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // ── Image area ─────────────────────────────────────────
  imageArea: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  imageScroll: {
    flex: 1,
  },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.52,
  },
  swipeArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    backgroundColor: 'rgba(166,61,51,0.65)',
    borderRadius: 20,
    padding: 6,
  },
  swipeArrowLeft: { left: 8 },
  swipeArrowRight: { right: 8 },
  // ── Caption ────────────────────────────────────────────
  captionBox: {
    backgroundColor: '#F3C6C0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
  },
  captionText: {
    color: '#3A1410',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  // ── Dots ───────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#F3C6C0',
    width: 20,
    borderRadius: 4,
  },
});


