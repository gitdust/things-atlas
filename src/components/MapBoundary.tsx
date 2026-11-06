import { Component, Suspense, lazy, type ComponentType } from 'react';
import type { MapViewProps } from './MapView';
import { MapShell } from './MapShell';

function createMapView(): ComponentType<MapViewProps> {
  return typeof window === 'undefined'
    ? ({ lang }) => <MapShell lang={lang} />
    : lazy(() => import('./MapView').then((module) => ({ default: module.MapView })));
}

export class MapBoundary extends Component<
  MapViewProps,
  { failed: boolean; MapView: ComponentType<MapViewProps> }
> {
  state = { failed: false, MapView: createMapView() };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  private retry = () => {
    // React.lazy caches rejected imports, so a retry needs a new lazy component.
    this.setState({ failed: false, MapView: createMapView() });
  };

  render() {
    if (this.state.failed) {
      return <MapShell lang={this.props.lang} failed onRetry={this.retry} />;
    }
    const MapView = this.state.MapView;
    return (
      <Suspense fallback={<MapShell lang={this.props.lang} />}>
        <MapView {...this.props} />
      </Suspense>
    );
  }
}
