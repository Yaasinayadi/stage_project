"use client";

import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import 'swiper/css/effect-fade';
import { Pagination, Autoplay, EffectFade, Navigation } from 'swiper/modules';

const tailwindSwiperStyles = [
  "[&_.swiper]:rounded-inherit",
  "[&_.swiper-pagination-bullet]:bg-white [&_.swiper-pagination-bullet]:opacity-50 [&_.swiper-pagination-bullet]:transition-all [&_.swiper-pagination-bullet]:w-2.5 [&_.swiper-pagination-bullet]:h-2.5",
  "[&_.swiper-pagination-bullet-active]:!bg-[hsl(var(--primary))] [&_.swiper-pagination-bullet-active]:opacity-100 [&_.swiper-pagination-bullet-active]:scale-125 [&_.swiper-pagination-bullet-active]:shadow-[0_0_10px_hsl(var(--primary)/0.5)]",
  "[&_.swiper-button-next]:text-white [&_.swiper-button-prev]:text-white",
  "[&_.swiper-button-next]:bg-white/10 [&_.swiper-button-prev]:bg-white/10",
  "[&_.swiper-button-next]:w-12 [&_.swiper-button-prev]:w-12 [&_.swiper-button-next]:h-12 [&_.swiper-button-prev]:h-12",
  "[&_.swiper-button-next]:rounded-full [&_.swiper-button-prev]:rounded-full",
  "[&_.swiper-button-next]:backdrop-blur-sm [&_.swiper-button-prev]:backdrop-blur-sm",
  "[&_.swiper-button-next]:border [&_.swiper-button-prev]:border [&_.swiper-button-next]:border-white/20 [&_.swiper-button-prev]:border-white/20",
  "[&_.swiper-button-next]:transition-all [&_.swiper-button-prev]:transition-all [&_.swiper-button-next]:duration-300 [&_.swiper-button-prev]:duration-300",
  "[&_.swiper-button-next]:opacity-0 [&_.swiper-button-prev]:opacity-0",
  "group-hover:[&_.swiper-button-next]:opacity-100 group-hover:[&_.swiper-button-prev]:opacity-100",
  "hover:[&_.swiper-button-next]:!bg-[hsl(var(--primary)/0.9)] hover:[&_.swiper-button-prev]:!bg-[hsl(var(--primary)/0.9)]",
  "hover:[&_.swiper-button-next]:!border-[hsl(var(--primary))] hover:[&_.swiper-button-prev]:!border-[hsl(var(--primary))]",
  "hover:[&_.swiper-button-next]:scale-110 hover:[&_.swiper-button-prev]:scale-110",
  "hover:[&_.swiper-button-next]:shadow-[0_4px_12px_hsl(var(--primary)/0.4)] hover:[&_.swiper-button-prev]:shadow-[0_4px_12px_hsl(var(--primary)/0.4)]",
  "[&_.swiper-button-next::after]:text-lg [&_.swiper-button-prev::after]:text-lg [&_.swiper-button-next::after]:font-extrabold [&_.swiper-button-prev::after]:font-extrabold"
].join(" ");

const slides = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1200&auto=format&fit=crop',
    title: 'Transformez votre support IT',
    description: 'Une gestion intelligente et rapide de vos demandes avec notre IA avancée. Gagnez en efficacité dès aujourd\'hui.',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop',
    title: 'Suivi en temps réel',
    description: 'Gardez un œil sur l\'évolution de vos tickets à chaque étape du processus, en toute transparence.',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop',
    title: 'Collaboration simplifiée',
    description: 'Interagissez facilement avec nos experts pour des solutions rapides et durables.',
  }
];

export default function WelcomeSlider() {
  return (
    <div className={`w-full h-[300px] sm:h-[400px] lg:h-[450px] relative rounded-[calc(var(--radius)+8px)] overflow-hidden shadow-2xl group slider-container border border-[hsl(var(--border))] ${tailwindSwiperStyles}`}>
      <Swiper
        pagination={{
          dynamicBullets: true,
          clickable: true,
        }}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        navigation={true}
        effect="fade"
        modules={[Pagination, Autoplay, EffectFade, Navigation]}
        className="welcomeSwiper w-full h-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id} className="relative w-full h-full overflow-hidden">
            <img 
              src={slide.image} 
              alt={slide.title} 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[10000ms] ease-out group-hover:scale-110"
            />
            {/* Elegant glassmorphism gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--background))] via-[hsl(var(--background)/0.6)] to-transparent opacity-90 dark:opacity-100"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
            
            <div className="absolute bottom-0 left-0 p-8 sm:p-12 text-left w-full sm:w-4/5 lg:w-2/3 z-10 flex flex-col justify-end h-full">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 animate-slide-up drop-shadow-lg leading-tight tracking-tight">
                {slide.title}
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-gray-200 animate-slide-up stagger-1 drop-shadow-md font-medium max-w-2xl">
                {slide.description}
              </p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
